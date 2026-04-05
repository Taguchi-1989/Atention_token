from typing import Optional

class PlaywrightSimulator:
    """Browser-based simulator using Playwright for real web pages."""

    DEFAULT_TIMEOUT = 5000  # milliseconds

    def __init__(self, headless: bool = True, timeout: int = DEFAULT_TIMEOUT):
        self._headless = headless
        self._timeout = timeout
        self._playwright = None
        self._browser = None
        self._page = None
        # Cache updated after each async operation so the sync accessor works inside
        # an already-running event loop (e.g. called from the async engine).
        self._visible_text_cache: str = "No page loaded"

    async def start(self, url: str) -> None:
        """Launch browser and navigate to URL."""
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self._headless)
        self._page = await self._browser.new_page()
        self._page.set_default_timeout(self._timeout)
        await self._page.goto(url, wait_until="domcontentloaded")
        self._visible_text_cache = await self._fetch_visible_text()

    def get_visible_text(self) -> str:
        """
        Return a cached text representation of the current page for the LLM.
        The cache is refreshed by start() and execute_action().
        Format mirrors SimpleWebSimulator._render_dom output.
        """
        return self._visible_text_cache

    async def _fetch_visible_text(self) -> str:
        """Fetch fresh visible text from the live page (async)."""
        if self._page is None:
            return "No page loaded"
        try:
            snapshot = await self._page.accessibility.snapshot()
            if snapshot:
                return self._render_accessibility_node(snapshot)
        except Exception:
            pass
        return await self._dom_fallback()

    def _render_accessibility_node(self, node: dict, depth: int = 0) -> str:
        """Render an accessibility tree node into a text representation."""
        lines = []
        prefix = "  " * depth
        role = node.get("role", "")
        name = node.get("name", "").strip()
        value = node.get("value", "")

        if role in ("WebArea", "RootWebArea"):
            pass  # top-level container — recurse children only
        elif role == "heading":
            if name:
                lines.append(f"{prefix}{name}")
        elif role in ("StaticText", "text"):
            if name:
                lines.append(f"{prefix}{name}")
        elif role == "textbox":
            placeholder = node.get("description", "")
            lines.append(
                f"{prefix}[INPUT role=textbox name='{name}' placeholder='{placeholder}'] Value='{value}'"
            )
        elif role == "button":
            lines.append(f"{prefix}[BUTTON] {name}")
        elif role == "link":
            if name:
                lines.append(f"{prefix}[LINK] {name}")
        elif role in ("combobox", "listbox"):
            lines.append(f"{prefix}[SELECT name='{name}'] Value='{value}'")
        elif role == "checkbox":
            checked = "checked" if node.get("checked") else "unchecked"
            lines.append(f"{prefix}[CHECKBOX name='{name}'] {checked}")
        elif role == "radio":
            checked = "checked" if node.get("checked") else "unchecked"
            lines.append(f"{prefix}[RADIO name='{name}'] {checked}")
        else:
            if name and role not in (
                "generic", "none", "presentation", "group", "list", "listitem"
            ):
                lines.append(f"{prefix}{name}")

        for child in node.get("children", []):
            child_text = self._render_accessibility_node(child, depth + 1)
            if child_text:
                lines.append(child_text)

        return "\n".join(filter(None, lines))

    async def _dom_fallback(self) -> str:
        """Fallback DOM traversal when accessibility snapshot is unavailable."""
        script = r"""
        () => {
            const lines = [];
            const skip = new Set(['script', 'style', 'noscript', 'meta', 'head']);

            function walk(node, depth) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) lines.push('  '.repeat(depth) + text);
                    return;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                const tag = node.tagName.toLowerCase();
                if (skip.has(tag)) return;

                const prefix = '  '.repeat(depth);
                if (tag === 'input') {
                    const id = node.id || node.name || 'N/A';
                    const placeholder = node.placeholder || '';
                    const val = node.value || '';
                    lines.push(`${prefix}[INPUT id=${id} placeholder='${placeholder}'] Value='${val}'`);
                    return;
                }
                if (tag === 'button') {
                    const id = node.id || 'N/A';
                    lines.push(`${prefix}[BUTTON id=${id}] ${node.innerText.trim()}`);
                    return;
                }
                if (tag === 'select') {
                    const id = node.id || node.name || 'N/A';
                    const val = node.value || '';
                    lines.push(`${prefix}[SELECT id=${id}] Value='${val}'`);
                }
                for (const child of node.childNodes) walk(child, depth + 1);
            }

            walk(document.body, 0);
            return lines.join('\n');
        }
        """
        try:
            result = await self._page.evaluate(script)
            return result or "Empty page"
        except Exception as exc:
            return f"DOM traversal failed: {exc}"

    async def execute_action(
        self, action: str, target: str, value: Optional[str] = None
    ) -> bool:
        """
        Execute action on the live page and refresh the visible text cache.

        action: "click", "input", "select", "scroll"
        target: CSS selector, visible text content, or aria-label
        Returns True if element found and action succeeded, False otherwise.
        """
        if self._page is None:
            return False

        locator = await self._resolve_locator(target)
        if locator is None:
            return False

        ok = False
        try:
            if action == "click":
                await locator.click(timeout=self._timeout)
                await self._page.wait_for_load_state("domcontentloaded")
                ok = True

            elif action == "input":
                await locator.fill(value or "", timeout=self._timeout)
                ok = True

            elif action == "select":
                await locator.select_option(value or "", timeout=self._timeout)
                ok = True

            elif action == "scroll":
                await self._page.evaluate("window.scrollBy(0, 300)")
                ok = True

        except Exception:
            pass

        # Refresh cache regardless so next get_visible_text() reflects current state
        self._visible_text_cache = await self._fetch_visible_text()
        return ok

    async def _resolve_locator(self, target: str):
        """
        Try to resolve target to a Playwright locator.
        Priority: CSS selector -> visible text -> aria-label.
        Uses a short probe timeout so that fallback strategies fail fast.
        Returns None if nothing found.
        """
        page = self._page
        # Use a shorter timeout per probe to avoid waiting full _timeout
        # for each fallback strategy when the element simply doesn't exist.
        probe_timeout = min(1500, self._timeout)

        # 1. CSS selector
        try:
            locator = page.locator(target).first
            await locator.wait_for(state="visible", timeout=probe_timeout)
            return locator
        except Exception:
            pass

        # 2. Visible text (partial match)
        try:
            locator = page.get_by_text(target, exact=False).first
            await locator.wait_for(state="visible", timeout=probe_timeout)
            return locator
        except Exception:
            pass

        # 3. Aria-label / form label
        try:
            locator = page.get_by_label(target).first
            await locator.wait_for(state="visible", timeout=probe_timeout)
            return locator
        except Exception:
            pass

        return None

    async def take_screenshot(self) -> bytes:
        """Capture current page screenshot as PNG bytes."""
        if self._page is None:
            return b""
        return await self._page.screenshot(type="png", full_page=False)

    async def close(self) -> None:
        """Close browser and clean up Playwright resources."""
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None
        self._page = None
