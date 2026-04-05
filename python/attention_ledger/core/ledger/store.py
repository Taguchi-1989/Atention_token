import sqlite3
import json
from typing import List, Optional
from .model import LedgerRecord


class LedgerStore:
    def __init__(self, db_path: str = "ledger.db"):
        self.db_path = db_path
        self._init_db()

    def _conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._conn() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            c = conn.cursor()
            c.execute('''
                CREATE TABLE IF NOT EXISTS baselines (
                    baseline_id TEXT PRIMARY KEY,
                    model TEXT,
                    engine TEXT,
                    system_prompt_hash TEXT,
                    temperature REAL,
                    created_at TEXT,
                    system_prompt TEXT
                )
            ''')
            # Migration: add system_prompt column if missing (existing DBs)
            try:
                c.execute('ALTER TABLE baselines ADD COLUMN system_prompt TEXT')
            except sqlite3.OperationalError:
                pass  # column already exists
            c.execute('''
                CREATE TABLE IF NOT EXISTS ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT,
                    baseline_id TEXT,
                    executed_at TEXT,
                    success BOOLEAN,
                    failure_reason TEXT,
                    total_tokens INTEGER,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    step_count INTEGER,
                    retry_count INTEGER,
                    metrics_json TEXT
                )
            ''')
            conn.commit()

    def save_record(self, record: LedgerRecord):
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('''
                INSERT INTO ledger (
                    task_id, baseline_id, executed_at, success, failure_reason,
                    total_tokens, input_tokens, output_tokens,
                    step_count, retry_count, metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.task_id,
                record.baseline_id,
                record.executed_at,
                record.success,
                record.failure_reason,
                record.metrics.total_tokens,
                record.metrics.input_tokens,
                record.metrics.output_tokens,
                record.metrics.step_count,
                record.metrics.retry_count,
                record.metrics.model_dump_json()
            ))
            conn.commit()

    def get_recent_records(self, limit: int = 10) -> List[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('SELECT * FROM ledger ORDER BY executed_at DESC LIMIT ?', (limit,))
            return c.fetchall()

    # ── Baseline CRUD ──

    def save_baseline(self, baseline) -> None:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('''
                INSERT OR REPLACE INTO baselines
                (baseline_id, model, engine, system_prompt_hash, temperature, created_at, system_prompt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                baseline.baseline_id, baseline.model, baseline.engine,
                baseline.system_prompt_hash, baseline.temperature, baseline.created_at,
                baseline.system_prompt,
            ))
            conn.commit()

    def get_all_baselines(self) -> List[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('SELECT * FROM baselines ORDER BY created_at DESC')
            return c.fetchall()

    def get_baseline(self, baseline_id: str) -> Optional[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('SELECT * FROM baselines WHERE baseline_id = ?', (baseline_id,))
            return c.fetchone()

    def delete_baseline(self, baseline_id: str) -> bool:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('DELETE FROM baselines WHERE baseline_id = ?', (baseline_id,))
            deleted = c.rowcount > 0
            conn.commit()
            return deleted

    # ── Metrics Diff ──

    def get_records_by_task_and_baseline(self, task_id: str, baseline_id: str) -> List[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('''
                SELECT * FROM ledger
                WHERE task_id = ? AND baseline_id = ?
                ORDER BY executed_at DESC
            ''', (task_id, baseline_id))
            return c.fetchall()

    def get_records_for_task(self, task_id: str, limit: int = 100) -> List[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute(
                'SELECT * FROM ledger WHERE task_id = ? ORDER BY executed_at ASC LIMIT ?',
                (task_id, limit),
            )
            return c.fetchall()

    def get_all_records(self, task_id: Optional[str] = None, baseline_id: Optional[str] = None) -> List[tuple]:
        with self._conn() as conn:
            c = conn.cursor()
            query = 'SELECT * FROM ledger'
            params: list = []
            clauses: list = []
            if task_id:
                clauses.append('task_id = ?')
                params.append(task_id)
            if baseline_id:
                clauses.append('baseline_id = ?')
                params.append(baseline_id)
            if clauses:
                query += ' WHERE ' + ' AND '.join(clauses)
            query += ' ORDER BY executed_at ASC'
            c.execute(query, params)
            return c.fetchall()

    # ── Dashboard Stats ──

    def get_stats(self) -> dict:
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('SELECT COUNT(*) FROM ledger')
            total_runs = c.fetchone()[0]
            c.execute('SELECT COUNT(*) FROM ledger WHERE success = 1')
            success_runs = c.fetchone()[0]
            c.execute('SELECT COUNT(DISTINCT task_id) FROM ledger')
            unique_tasks = c.fetchone()[0]
            c.execute('SELECT COUNT(*) FROM baselines')
            total_baselines = c.fetchone()[0]
            c.execute('SELECT SUM(total_tokens) FROM ledger')
            total_tokens = c.fetchone()[0] or 0
            return {
                "total_runs": total_runs,
                "success_runs": success_runs,
                "unique_tasks": unique_tasks,
                "total_baselines": total_baselines,
                "total_tokens": total_tokens,
            }

    def update_sus_by_run_id(self, run_id: int, sus_score: float, sus_responses: List[int]) -> bool:
        """Attach SUS score to a specific run by its ledger id."""
        with self._conn() as conn:
            c = conn.cursor()
            c.execute('SELECT id, metrics_json FROM ledger WHERE id = ?', (run_id,))
            row = c.fetchone()
            if not row:
                return False

            record_id, metrics_str = row
            if not metrics_str:
                return False

            try:
                metrics_dict = json.loads(metrics_str)
                metrics_dict['sus_inspired_score'] = sus_score
                metrics_dict['sus_inspired_responses'] = sus_responses
                c.execute('UPDATE ledger SET metrics_json = ? WHERE id = ?',
                          (json.dumps(metrics_dict), record_id))
                conn.commit()
                return True
            except (json.JSONDecodeError, TypeError):
                return False
