import sqlite3
import json
from pathlib import Path
from typing import List, Optional
from .model import LedgerRecord, CoreMetrics

class LedgerStore:
    def __init__(self, db_path: str = "ledger.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Create Baselines table
        c.execute('''
            CREATE TABLE IF NOT EXISTS baselines (
                baseline_id TEXT PRIMARY KEY,
                model TEXT,
                engine TEXT,
                system_prompt_hash TEXT,
                temperature REAL,
                created_at TEXT
            )
        ''')

        # Create Tasks table (History/Ledger)
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
        conn.close()

    def save_record(self, record: LedgerRecord):
        conn = sqlite3.connect(self.db_path)
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
            record.metrics.json()
        ))
        
        conn.commit()
        conn.close()
        print(f"Record saved to {self.db_path}")

    def get_recent_records(self, limit: int = 10) -> List[tuple]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('SELECT * FROM ledger ORDER BY executed_at DESC LIMIT ?', (limit,))
        rows = c.fetchall()
        conn.close()
        return rows

    def update_sus_metrics(self, task_id: str, baseline_id: str, sus_score: float, sus_responses: List[int]) -> bool:
        """
        Updates the latest record for the given task and baseline with SUS metrics.
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # 1. Find latest record
        c.execute('''
            SELECT id, metrics_json FROM ledger 
            WHERE task_id = ? AND baseline_id = ? 
            ORDER BY executed_at DESC LIMIT 1
        ''', (task_id, baseline_id))
        
        row = c.fetchone()
        if not row:
            conn.close()
            return False
            
        record_id, metrics_str = row
        
        # 2. Update JSON
        try:
            metrics_dict = json.loads(metrics_str)
            metrics_dict['sus_inspired_score'] = sus_score
            metrics_dict['sus_inspired_responses'] = sus_responses
            new_metrics_str = json.dumps(metrics_dict)
            
            # 3. Save back
            c.execute('UPDATE ledger SET metrics_json = ? WHERE id = ?', (new_metrics_str, record_id))
            conn.commit()
            updated = True
        except Exception as e:
            print(f"Error updating SUS metrics: {e}")
            updated = False
            
        conn.close()
        return updated
