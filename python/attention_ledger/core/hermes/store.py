import json
import sqlite3
from pathlib import Path
from typing import List, Optional

from .model import HermesFinding, HermesNetworkRecord, HermesRunResult, HermesStepRecord


class HermesStore:
    def __init__(self, db_path: str, artifact_dir: str):
        self.db_path = db_path
        self.artifact_dir = Path(artifact_dir)
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            c = conn.cursor()
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS hermes_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_key TEXT UNIQUE,
                    started_at TEXT,
                    completed_at TEXT,
                    status TEXT,
                    url TEXT,
                    sanitized_url TEXT,
                    task TEXT,
                    product_area TEXT,
                    profile_name TEXT,
                    load_ms INTEGER,
                    dom_content_loaded_ms INTEGER,
                    ttfb_ms INTEGER,
                    fcp_ms INTEGER,
                    lcp_ms INTEGER,
                    cls REAL,
                    step_count INTEGER,
                    retry_count INTEGER,
                    total_tokens INTEGER,
                    privacy_mode TEXT,
                    config_json TEXT
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS hermes_steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER,
                    step_index INTEGER,
                    url TEXT,
                    title TEXT,
                    action TEXT,
                    duration_ms INTEGER,
                    screenshot_path TEXT,
                    summary_json TEXT,
                    FOREIGN KEY(run_id) REFERENCES hermes_runs(id)
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS hermes_network (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER,
                    method TEXT,
                    url TEXT,
                    host TEXT,
                    path TEXT,
                    resource_type TEXT,
                    status INTEGER,
                    duration_ms INTEGER,
                    body_saved BOOLEAN,
                    headers_saved BOOLEAN,
                    FOREIGN KEY(run_id) REFERENCES hermes_runs(id)
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS hermes_findings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER,
                    type TEXT,
                    severity TEXT,
                    message TEXT,
                    evidence_json TEXT,
                    FOREIGN KEY(run_id) REFERENCES hermes_runs(id)
                )
                """
            )
            c.execute("CREATE INDEX IF NOT EXISTS idx_hermes_runs_target ON hermes_runs(product_area, sanitized_url, task)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_hermes_steps_run ON hermes_steps(run_id, step_index)")
            conn.commit()

    def save_run(self, result: HermesRunResult) -> HermesRunResult:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute(
                """
                INSERT INTO hermes_runs (
                    run_key, started_at, completed_at, status, url, sanitized_url,
                    task, product_area, profile_name, load_ms, dom_content_loaded_ms,
                    ttfb_ms, fcp_ms, lcp_ms, cls, step_count, retry_count,
                    total_tokens, privacy_mode, config_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.run_key,
                    result.started_at,
                    result.completed_at,
                    result.status,
                    result.url,
                    result.sanitized_url,
                    result.task,
                    result.product_area,
                    result.profile_name,
                    result.load_ms,
                    result.dom_content_loaded_ms,
                    result.ttfb_ms,
                    result.fcp_ms,
                    result.lcp_ms,
                    result.cls,
                    result.step_count,
                    result.retry_count,
                    result.total_tokens,
                    result.privacy_mode,
                    json.dumps(result.config_json, ensure_ascii=False),
                ),
            )
            run_id = c.lastrowid
            for step in result.steps:
                self._insert_step(c, run_id, step)
            for entry in result.network:
                self._insert_network(c, run_id, entry)
            for finding in result.findings:
                self._insert_finding(c, run_id, finding)
            conn.commit()
        result.id = run_id
        return result

    def _insert_step(self, c, run_id: int, step: HermesStepRecord) -> None:
        c.execute(
            """
            INSERT INTO hermes_steps (
                run_id, step_index, url, title, action, duration_ms,
                screenshot_path, summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                step.step_index,
                step.url,
                step.title,
                step.action,
                step.duration_ms,
                step.screenshot_path,
                json.dumps(step.summary_json, ensure_ascii=False),
            ),
        )

    def _insert_network(self, c, run_id: int, entry: HermesNetworkRecord) -> None:
        c.execute(
            """
            INSERT INTO hermes_network (
                run_id, method, url, host, path, resource_type, status,
                duration_ms, body_saved, headers_saved
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                entry.method,
                entry.url,
                entry.host,
                entry.path,
                entry.resource_type,
                entry.status,
                entry.duration_ms,
                entry.body_saved,
                entry.headers_saved,
            ),
        )

    def _insert_finding(self, c, run_id: int, finding: HermesFinding) -> None:
        c.execute(
            """
            INSERT INTO hermes_findings (run_id, type, severity, message, evidence_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                run_id,
                finding.type,
                finding.severity,
                finding.message,
                json.dumps(finding.evidence_json, ensure_ascii=False),
            ),
        )

    def list_runs(self, limit: int = 50) -> List[dict]:
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT r.*,
                       (SELECT COUNT(*) FROM hermes_findings f WHERE f.run_id = r.id) AS finding_count
                FROM hermes_runs r
                ORDER BY r.started_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_run(self, run_id: int) -> Optional[dict]:
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            run = conn.execute("SELECT * FROM hermes_runs WHERE id = ?", (run_id,)).fetchone()
            if not run:
                return None
            payload = dict(run)
            payload["config_json"] = self._loads(payload.get("config_json"))
            payload["steps"] = [
                self._row_with_json(row, "summary_json")
                for row in conn.execute(
                    "SELECT * FROM hermes_steps WHERE run_id = ? ORDER BY step_index ASC", (run_id,)
                ).fetchall()
            ]
            payload["network"] = [dict(row) for row in conn.execute(
                "SELECT * FROM hermes_network WHERE run_id = ? ORDER BY duration_ms DESC", (run_id,)
            ).fetchall()]
            payload["findings"] = [
                self._row_with_json(row, "evidence_json")
                for row in conn.execute(
                    "SELECT * FROM hermes_findings WHERE run_id = ? ORDER BY id ASC", (run_id,)
                ).fetchall()
            ]
            return payload

    def get_previous_run(self, sanitized_url: str, task: str, product_area: str, before_run_key: str) -> Optional[dict]:
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                """
                SELECT * FROM hermes_runs
                WHERE sanitized_url = ? AND task = ? AND product_area = ? AND run_key != ?
                ORDER BY started_at DESC
                LIMIT 1
                """,
                (sanitized_url, task, product_area, before_run_key),
            ).fetchone()
            return dict(row) if row else None

    def resolve_screenshot(self, run_id: int, step_index: int) -> Optional[Path]:
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT screenshot_path FROM hermes_steps
                WHERE run_id = ? AND step_index = ?
                """,
                (run_id, step_index),
            ).fetchone()
            if not row or not row[0]:
                return None
            path = (self.artifact_dir / row[0]).resolve()
            if not path.is_file() or not path.is_relative_to(self.artifact_dir.resolve()):
                return None
            return path

    def _row_with_json(self, row, key: str) -> dict:
        payload = dict(row)
        payload[key] = self._loads(payload.get(key))
        return payload

    def _loads(self, value):
        if not value:
            return {}
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}

