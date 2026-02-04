from pathlib import Path
from typing import List, Optional
import os

from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel

from attention_ledger.core.task.loader import TaskLoader
from attention_ledger.core.ledger.store import LedgerStore
from attention_ledger.core.metrics.model import CoreMetrics
from attention_ledger.core.metrics.sus import compute_sus_inspired_score
from attention_ledger.core.ledger.model import LedgerRecord
from attention_ledger.core.agent.agent import FirstTimeUserAgent
from attention_ledger.core.execute.engine import ExecutionEngine
from attention_ledger.core.llm.adapter import OllamaAdapter
from attention_ledger.core.llm.mock_adapter import MockAdapter

app = FastAPI(title="Attention Ledger Local API", version="0.1.0")

_PYTHON_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_TASKS_DIR = _PYTHON_DIR / "tasks"
_DEFAULT_DB_PATH = _PYTHON_DIR / "ledger.db"


class TaskSummary(BaseModel):
    task_id: str
    description: str
    start_condition: str
    goal_condition: str


class RunSummary(BaseModel):
    id: int
    task_id: str
    baseline_id: str
    executed_at: str
    success: bool
    failure_reason: Optional[str] = None
    total_tokens: int
    input_tokens: int
    output_tokens: int
    step_count: int
    retry_count: int
    metrics: Optional[dict] = None


class SusSubmission(BaseModel):
    task_id: str
    baseline_id: str
    responses: List[int]
    executed_at: Optional[str] = None


class RunRequest(BaseModel):
    baseline_id: str
    mock: bool = False
    max_steps: Optional[int] = None


def _tasks_dir() -> Path:
    return Path(os.getenv("ATTENTION_LEDGER_TASKS_DIR", str(_DEFAULT_TASKS_DIR)))


def _db_path() -> str:
    return os.getenv("ATTENTION_LEDGER_DB_PATH", str(_DEFAULT_DB_PATH))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/tasks", response_model=List[TaskSummary])
def list_tasks():
    tasks = TaskLoader.load_all_from_dir(str(_tasks_dir()))
    return [
        TaskSummary(
            task_id=t.task_id,
            description=t.description,
            start_condition=t.start_condition,
            goal_condition=t.goal_condition,
        )
        for t in tasks
    ]


@app.get("/runs", response_model=List[RunSummary])
def list_runs(
    limit: int = Query(10, ge=1, le=100),
    include_metrics: bool = Query(False),
):
    store = LedgerStore(db_path=_db_path())
    rows = store.get_recent_records(limit=limit)
    results: List[RunSummary] = []
    for row in rows:
        # schema: id, task_id, baseline_id, executed_at, success,
        # failure_reason, total_tokens, input_tokens, output_tokens,
        # step_count, retry_count, metrics_json
        metrics_payload = None
        if include_metrics and row[11]:
            try:
                import json
                metrics_payload = json.loads(row[11])
            except Exception:
                metrics_payload = None

        results.append(
            RunSummary(
                id=row[0],
                task_id=row[1],
                baseline_id=row[2],
                executed_at=row[3],
                success=bool(row[4]),
                failure_reason=row[5],
                total_tokens=row[6],
                input_tokens=row[7],
                output_tokens=row[8],
                step_count=row[9],
                retry_count=row[10],
                metrics=metrics_payload,
            )
        )
    return results


@app.get("/history", response_model=List[RunSummary])
def list_history(
    limit: int = Query(10, ge=1, le=100),
    include_metrics: bool = Query(False),
):
    return list_runs(limit=limit, include_metrics=include_metrics)


@app.post("/tasks/{task_id}/run")
async def run_task(task_id: str, payload: RunRequest):
    task_file = _tasks_dir() / f"{task_id}.yaml"
    if not task_file.exists():
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

    task = TaskLoader.load_from_file(str(task_file))

    adapter = MockAdapter() if payload.mock else OllamaAdapter()
    agent = FirstTimeUserAgent(adapter)
    engine = ExecutionEngine(agent)

    result = await engine.run_task(
        task,
        payload.baseline_id,
        max_steps=payload.max_steps or 20,
    )

    store = LedgerStore(db_path=_db_path())
    store.save_record(result)

    return {
        "status": "saved",
        "task_id": result.task_id,
        "baseline_id": result.baseline_id,
        "executed_at": result.executed_at,
        "success": result.success,
        "failure_reason": result.failure_reason,
        "metrics": result.metrics.dict(),
    }


@app.post("/sus")
def submit_sus(payload: SusSubmission):
    try:
        score = compute_sus_inspired_score(payload.responses)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    metrics = CoreMetrics(
        sus_inspired_score=score,
        sus_inspired_responses=payload.responses,
    )

    record = LedgerRecord(
        task_id=payload.task_id,
        baseline_id=payload.baseline_id,
        executed_at=payload.executed_at or _utc_now_iso(),
        metrics=metrics,
        success=True,
        failure_reason=None,
    )

    store = LedgerStore(db_path=_db_path())
    store.save_record(record)
    return {"status": "saved", "sus_inspired_score": score}


def _utc_now_iso() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat()
