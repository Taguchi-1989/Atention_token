"""
Tests for PlaywrightSimulator using a local HTTP server serving a simple HTML form.

Run with:
    pytest python/tests/test_playwright_simulator.py -v

Requires playwright to be installed:
    pip install playwright
    playwright install chromium
"""

import threading
import http.server
import functools
import textwrap
import pytest

playwright = pytest.importorskip("playwright")

from attention_ledger.core.execute.playwright_simulator import PlaywrightSimulator

# ---------------------------------------------------------------------------
# Minimal HTML page served for tests
# ---------------------------------------------------------------------------

FORM_HTML = textwrap.dedent("""\
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Test Form</title></head>
    <body>
      <h1>Test Page</h1>
      <form id="test-form">
        <label for="name-input">Name</label>
        <input id="name-input" type="text" placeholder="Enter name" />

        <label for="email-input">Email</label>
        <input id="email-input" type="email" placeholder="Enter email" />

        <button id="submit-btn" type="submit">Submit</button>
      </form>
    </body>
    </html>
""")


def _make_handler(html: str):
    """Return a BaseHTTPRequestHandler subclass that always serves html."""

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # silence request logs during tests
            pass

    return _Handler


@pytest.fixture(scope="module")
def local_server():
    """Spin up a temporary HTTP server on a free port for the test module."""
    handler = _make_handler(FORM_HTML)
    server = http.server.HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}"
    yield url
    server.shutdown()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_start_and_close(local_server):
    """Browser can start and close without error."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    await sim.close()


@pytest.mark.asyncio
async def test_get_visible_text_contains_form_elements(local_server):
    """get_visible_text returns content that includes the form inputs and button."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        text = sim.get_visible_text()
        # The text representation must mention the input and the button
        assert "name" in text.lower() or "input" in text.lower(), (
            f"Expected input element reference in visible text, got:\n{text}"
        )
        assert "submit" in text.lower(), (
            f"Expected submit button reference in visible text, got:\n{text}"
        )
    finally:
        await sim.close()


@pytest.mark.asyncio
async def test_execute_action_input(local_server):
    """execute_action 'input' fills a text field successfully."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        result = await sim.execute_action("input", "#name-input", "Alice")
        assert result is True, "Expected True when filling a known input field"

        # Verify the value was actually set in the page
        value = await sim._page.input_value("#name-input")
        assert value == "Alice", f"Expected 'Alice', got '{value}'"
    finally:
        await sim.close()


@pytest.mark.asyncio
async def test_execute_action_click(local_server):
    """execute_action 'click' finds and clicks a button successfully."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        result = await sim.execute_action("click", "#submit-btn")
        assert result is True, "Expected True when clicking a known button"
    finally:
        await sim.close()


@pytest.mark.asyncio
async def test_execute_action_returns_false_for_missing_element(local_server):
    """execute_action returns False when the target does not exist."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        result = await sim.execute_action("click", "#nonexistent-element-xyz")
        assert result is False, "Expected False for missing element"
    finally:
        await sim.close()


@pytest.mark.asyncio
async def test_take_screenshot_returns_png_bytes(local_server):
    """take_screenshot returns non-empty PNG bytes."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        data = await sim.take_screenshot()
        assert isinstance(data, bytes), "Screenshot must be bytes"
        assert len(data) > 0, "Screenshot bytes must be non-empty"
        # PNG magic bytes
        assert data[:4] == b"\x89PNG", "Screenshot must be a valid PNG"
    finally:
        await sim.close()


@pytest.mark.asyncio
async def test_execute_action_input_by_label(local_server):
    """execute_action resolves inputs by aria-label / visible label text."""
    sim = PlaywrightSimulator()
    await sim.start(local_server)
    try:
        # Target by label text (aria resolution)
        result = await sim.execute_action("input", "Email", "user@example.com")
        assert result is True, "Expected True when targeting input by label"
    finally:
        await sim.close()
