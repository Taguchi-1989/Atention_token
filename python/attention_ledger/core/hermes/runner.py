import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from .model import (
    HermesFinding,
    HermesNetworkRecord,
    HermesRunConfig,
    HermesRunResult,
    HermesStepRecord,
)
from .store import HermesStore


DEFAULT_REDACT_SELECTORS = [
    "input",
    "textarea",
    "select",
    "[contenteditable='true']",
    "[data-hermes-redact]",
    "[data-private]",
    "[aria-label*='password' i]",
    "[aria-label*='secret' i]",
    "[aria-label*='token' i]",
]

SENSITIVE_QUERY_KEYS = {
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "code",
    "password",
    "email",
    "key",
    "secret",
    "session",
}


class HermesRunner:
    def __init__(self, store: HermesStore, artifact_dir: str, profile_root: str):
        self.store = store
        self.artifact_dir = Path(artifact_dir)
        self.profile_root = Path(profile_root)
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.profile_root.mkdir(parents=True, exist_ok=True)

    async def run(self, config: HermesRunConfig) -> HermesRunResult:
        started_at = _utc_now_iso()
        run_key = f"hermes_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        sanitized_url = sanitize_url(config.url)
        allowed_hosts = _allowed_hosts(config)
        _assert_allowed(config.url, allowed_hosts)

        run_dir = self.artifact_dir / run_key
        run_dir.mkdir(parents=True, exist_ok=True)

        network_records: List[HermesNetworkRecord] = []
        request_started: Dict[object, float] = {}
        findings: List[HermesFinding] = []
        steps: List[HermesStepRecord] = []
        metrics: Dict[str, Optional[float]] = {}
        status = "completed"

        try:
            from playwright.async_api import async_playwright
        except ModuleNotFoundError:
            result = HermesRunResult(
                run_key=run_key,
                started_at=started_at,
                completed_at=_utc_now_iso(),
                status="error",
                url=config.url,
                sanitized_url=sanitized_url,
                task=config.task,
                product_area=config.product_area,
                profile_name=config.profile_name,
                privacy_mode="metadata_only_redacted_screenshot",
                config_json=config.model_dump(),
                findings=[
                    HermesFinding(
                        type="missing_dependency",
                        severity="high",
                        message="Python Playwright is not installed in this environment.",
                        evidence_json={"package": "playwright"},
                    )
                ],
            )
            return self.store.save_run(result)

        playwright = await async_playwright().start()
        browser_context = None
        try:
            profile_dir = self.profile_root / _safe_profile_name(config.profile_name)
            browser_context = await playwright.chromium.launch_persistent_context(
                str(profile_dir),
                headless=True,
                viewport={"width": 1365, "height": 768},
            )
            page = browser_context.pages[0] if browser_context.pages else await browser_context.new_page()
            page.set_default_timeout(30000)

            await page.add_init_script(
                """
                (() => {
                  window.__hermesVitals = { fcp: null, lcp: null, cls: 0 };
                  try {
                    new PerformanceObserver((list) => {
                      for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                          window.__hermesVitals.fcp = Math.round(entry.startTime);
                        }
                      }
                    }).observe({ type: 'paint', buffered: true });
                    new PerformanceObserver((list) => {
                      const entries = list.getEntries();
                      const last = entries[entries.length - 1];
                      if (last) window.__hermesVitals.lcp = Math.round(last.startTime);
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                    new PerformanceObserver((list) => {
                      for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) window.__hermesVitals.cls += entry.value;
                      }
                    }).observe({ type: 'layout-shift', buffered: true });
                  } catch (_) {}
                })();
                """
            )

            if config.capture_network:
                page.on("request", lambda request: request_started.__setitem__(request, time.perf_counter()))

                def on_response(response):
                    request = response.request
                    parsed = urlparse(request.url)
                    if parsed.hostname and parsed.hostname not in allowed_hosts:
                        return
                    start = request_started.pop(request, None)
                    duration_ms = int((time.perf_counter() - start) * 1000) if start else None
                    network_records.append(
                        HermesNetworkRecord(
                            method=request.method,
                            url=sanitize_url(request.url),
                            host=parsed.hostname or "",
                            path=parsed.path or "/",
                            resource_type=request.resource_type,
                            status=response.status,
                            duration_ms=duration_ms,
                        )
                    )

                page.on("response", on_response)

            nav_started = time.perf_counter()
            response = await page.goto(config.url, wait_until="domcontentloaded")
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            duration_ms = int((time.perf_counter() - nav_started) * 1000)
            metrics = await _collect_performance(page)
            if response and response.status >= 400:
                findings.append(
                    HermesFinding(
                        type="page_status",
                        severity="high",
                        message=f"Initial page returned HTTP {response.status}.",
                        evidence_json={"status": response.status},
                    )
                )

            screenshot_path = None
            redacted_count = 0
            if config.save_screenshots:
                redacted_count = await _apply_redaction_overlays(page, config.redact_selectors)
                screenshot_name = "step-01-redacted.png"
                await page.screenshot(path=str(run_dir / screenshot_name), type="png", full_page=False)
                screenshot_path = f"{run_key}/{screenshot_name}"
                await _remove_redaction_overlays(page)

            steps.append(
                HermesStepRecord(
                    step_index=1,
                    url=sanitize_url(page.url),
                    title=await page.title(),
                    action="load",
                    duration_ms=duration_ms,
                    screenshot_path=screenshot_path,
                    summary_json=await _safe_page_summary(page, redacted_count),
                )
            )

        except Exception as exc:
            status = "error"
            findings.append(
                HermesFinding(
                    type="run_error",
                    severity="high",
                    message="Hermes run failed before completion.",
                    evidence_json={"error": str(exc)[:500]},
                )
            )
        finally:
            if browser_context is not None:
                await browser_context.close()
            await playwright.stop()

        load_ms = _int_metric(metrics.get("load_ms")) or (steps[0].duration_ms if steps else None)
        dom_content_loaded_ms = _int_metric(metrics.get("dom_content_loaded_ms"))
        ttfb_ms = _int_metric(metrics.get("ttfb_ms"))
        fcp_ms = _int_metric(metrics.get("fcp_ms"))
        lcp_ms = _int_metric(metrics.get("lcp_ms"))
        cls = metrics.get("cls")

        findings.extend(_performance_findings(load_ms, dom_content_loaded_ms, lcp_ms, cls, network_records))
        findings.extend(_baseline_findings(self.store, sanitized_url, config, run_key, load_ms, lcp_ms))

        result = HermesRunResult(
            run_key=run_key,
            started_at=started_at,
            completed_at=_utc_now_iso(),
            status=status,
            url=config.url,
            sanitized_url=sanitized_url,
            task=config.task,
            product_area=config.product_area,
            profile_name=config.profile_name,
            load_ms=load_ms,
            dom_content_loaded_ms=dom_content_loaded_ms,
            ttfb_ms=ttfb_ms,
            fcp_ms=fcp_ms,
            lcp_ms=lcp_ms,
            cls=round(float(cls), 4) if cls is not None else None,
            step_count=len(steps),
            retry_count=0,
            total_tokens=0,
            privacy_mode="metadata_only_redacted_screenshot",
            config_json={
                **config.model_dump(),
                "allow_hosts": sorted(allowed_hosts),
                "redaction": {
                    "default_selectors": DEFAULT_REDACT_SELECTORS,
                    "custom_selectors": config.redact_selectors,
                },
                "saves_request_body": False,
                "saves_response_body": False,
                "saves_headers": False,
            },
            steps=steps,
            network=network_records,
            findings=findings,
        )
        return self.store.save_run(result)


def sanitize_url(url: str) -> str:
    parsed = urlparse(url)
    safe_query = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        lowered = key.lower()
        if lowered in SENSITIVE_QUERY_KEYS or any(token in lowered for token in ("token", "secret", "password", "session")):
            safe_query.append((key, "[redacted]"))
        else:
            safe_query.append((key, value if len(value) <= 80 else "[redacted-long]"))
    return urlunparse(parsed._replace(query=urlencode(safe_query), fragment=""))


def _allowed_hosts(config: HermesRunConfig) -> set[str]:
    parsed = urlparse(config.url)
    hosts = {host.lower() for host in config.allow_hosts if host}
    if parsed.hostname:
        hosts.add(parsed.hostname.lower())
    return hosts


def _assert_allowed(url: str, allowed_hosts: set[str]) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Hermes only supports http and https URLs.")
    if not parsed.hostname or parsed.hostname.lower() not in allowed_hosts:
        raise ValueError("URL host is not included in allow_hosts.")


def _safe_profile_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", name).strip("._")
    return cleaned or "default"


async def _collect_performance(page) -> Dict[str, Optional[float]]:
    return await page.evaluate(
        """
        () => {
          const nav = performance.getEntriesByType('navigation')[0];
          const vitals = window.__hermesVitals || {};
          if (!nav) return { fcp_ms: vitals.fcp || null, lcp_ms: vitals.lcp || null, cls: vitals.cls || 0 };
          return {
            ttfb_ms: Math.round(nav.responseStart - nav.requestStart),
            dom_content_loaded_ms: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            load_ms: Math.round((nav.loadEventEnd || nav.domContentLoadedEventEnd) - nav.startTime),
            fcp_ms: vitals.fcp || null,
            lcp_ms: vitals.lcp || null,
            cls: Number((vitals.cls || 0).toFixed(4))
          };
        }
        """
    )


async def _apply_redaction_overlays(page, custom_selectors: List[str]) -> int:
    selectors = DEFAULT_REDACT_SELECTORS + custom_selectors
    return await page.evaluate(
        """
        (selectors) => {
          window.__hermesRedactionOverlays = window.__hermesRedactionOverlays || [];
          let count = 0;
          const seen = new Set();
          for (const selector of selectors) {
            let nodes = [];
            try { nodes = Array.from(document.querySelectorAll(selector)); } catch (_) { continue; }
            for (const node of nodes) {
              if (!(node instanceof Element) || seen.has(node)) continue;
              seen.add(node);
              const rect = node.getBoundingClientRect();
              if (rect.width < 1 || rect.height < 1) continue;
              const overlay = document.createElement('div');
              overlay.setAttribute('data-hermes-overlay', 'true');
              Object.assign(overlay.style, {
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                background: '#05080d',
                border: '1px solid rgba(90, 210, 255, 0.65)',
                zIndex: '2147483647',
                pointerEvents: 'none',
                boxSizing: 'border-box'
              });
              document.body.appendChild(overlay);
              window.__hermesRedactionOverlays.push(overlay);
              count += 1;
            }
          }
          return count;
        }
        """,
        selectors,
    )


async def _remove_redaction_overlays(page) -> None:
    await page.evaluate(
        """
        () => {
          for (const overlay of window.__hermesRedactionOverlays || []) overlay.remove();
          window.__hermesRedactionOverlays = [];
        }
        """
    )


async def _safe_page_summary(page, redacted_count: int) -> dict:
    return await page.evaluate(
        """
        (redactedCount) => {
          const count = (selector) => {
            try { return document.querySelectorAll(selector).length; } catch (_) { return 0; }
          };
          const headingTexts = Array.from(document.querySelectorAll('h1,h2'))
            .slice(0, 8)
            .map((el) => (el.textContent || '').trim())
            .filter(Boolean)
            .map((text) => text.length > 80 ? text.slice(0, 77) + '...' : text);
          return {
            title: document.title || '',
            redacted_count: redactedCount,
            element_counts: {
              links: count('a'),
              buttons: count('button'),
              inputs: count('input,textarea,select'),
              images: count('img')
            },
            headings: headingTexts
          };
        }
        """,
        redacted_count,
    )


def _performance_findings(
    load_ms: Optional[int],
    dom_content_loaded_ms: Optional[int],
    lcp_ms: Optional[int],
    cls: Optional[float],
    network: List[HermesNetworkRecord],
) -> List[HermesFinding]:
    findings: List[HermesFinding] = []
    if load_ms and load_ms > 3000:
        findings.append(HermesFinding(
            type="slow_page_load",
            severity="medium",
            message=f"Page load took {load_ms}ms.",
            evidence_json={"load_ms": load_ms},
        ))
    if dom_content_loaded_ms and dom_content_loaded_ms > 2000:
        findings.append(HermesFinding(
            type="slow_dom_content_loaded",
            severity="low",
            message=f"DOMContentLoaded took {dom_content_loaded_ms}ms.",
            evidence_json={"dom_content_loaded_ms": dom_content_loaded_ms},
        ))
    if lcp_ms and lcp_ms > 2500:
        findings.append(HermesFinding(
            type="slow_lcp",
            severity="medium",
            message=f"LCP is {lcp_ms}ms, above the 2500ms target.",
            evidence_json={"lcp_ms": lcp_ms},
        ))
    if cls and cls > 0.1:
        findings.append(HermesFinding(
            type="layout_shift",
            severity="medium",
            message=f"CLS is {cls}, above the 0.1 target.",
            evidence_json={"cls": cls},
        ))
    for entry in network[:200]:
        if entry.status and entry.status >= 400:
            findings.append(HermesFinding(
                type="failed_request",
                severity="high" if entry.status >= 500 else "medium",
                message=f"{entry.method} {entry.path} returned HTTP {entry.status}.",
                evidence_json={"url": entry.url, "status": entry.status, "duration_ms": entry.duration_ms},
            ))
        elif entry.duration_ms and entry.duration_ms > 1000 and entry.resource_type in {"fetch", "xhr", "document"}:
            findings.append(HermesFinding(
                type="slow_response",
                severity="medium",
                message=f"{entry.method} {entry.path} took {entry.duration_ms}ms.",
                evidence_json={"url": entry.url, "duration_ms": entry.duration_ms},
            ))
    return findings


def _baseline_findings(
    store: HermesStore,
    sanitized_url: str,
    config: HermesRunConfig,
    run_key: str,
    load_ms: Optional[int],
    lcp_ms: Optional[int],
) -> List[HermesFinding]:
    previous = store.get_previous_run(sanitized_url, config.task, config.product_area, run_key)
    if not previous:
        return []
    findings: List[HermesFinding] = []
    prev_load = previous.get("load_ms")
    if load_ms and prev_load and load_ms - prev_load > max(500, prev_load * 0.25):
        findings.append(HermesFinding(
            type="regression_load_time",
            severity="medium",
            message=f"Load time regressed by {load_ms - prev_load}ms compared with the previous Hermes run.",
            evidence_json={"previous_load_ms": prev_load, "current_load_ms": load_ms},
        ))
    prev_lcp = previous.get("lcp_ms")
    if lcp_ms and prev_lcp and lcp_ms - prev_lcp > max(500, prev_lcp * 0.25):
        findings.append(HermesFinding(
            type="regression_lcp",
            severity="medium",
            message=f"LCP regressed by {lcp_ms - prev_lcp}ms compared with the previous Hermes run.",
            evidence_json={"previous_lcp_ms": prev_lcp, "current_lcp_ms": lcp_ms},
        ))
    return findings


def _int_metric(value) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()
