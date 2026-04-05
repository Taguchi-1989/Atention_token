import logging
import re
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import asyncio
import json
import os
import hashlib
from urllib.parse import urlparse

from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from attention_ledger.core.task.loader import TaskLoader
from attention_ledger.core.ledger.store import LedgerStore
from attention_ledger.core.ledger.model import Baseline
from attention_ledger.core.metrics.sus import compute_sus_inspired_score
from attention_ledger.core.agent.agent import FirstTimeUserAgent
from attention_ledger.core.execute.engine import ExecutionEngine
from attention_ledger.core.llm.adapter import OllamaAdapter
from attention_ledger.core.llm.mock_adapter import MockAdapter
from attention_ledger.core.llm.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(title="Attention Ledger Local API", version="0.3.0")

# ── Security Headers ──

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# ── Paths ──
_PYTHON_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_TASKS_DIR = _PYTHON_DIR / "tasks"
_DEFAULT_DB_PATH = _PYTHON_DIR / "ledger.db"

# ── Input validation ──
_SAFE_ID_RE = re.compile(r'^[a-zA-Z0-9_\-]+$')
_ALLOWED_OLLAMA_HOSTS = {"localhost", "127.0.0.1"}
_MAX_STEPS_LIMIT = 100
_MAX_CONCURRENT_RUNS = 10
_RUN_TTL_SECONDS = 3600  # 1 hour


def _validate_id(value: str, name: str = "id") -> str:
    if not _SAFE_ID_RE.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {name}: only alphanumeric, dash, underscore allowed")
    if len(value) > 128:
        raise HTTPException(status_code=400, detail=f"{name} too long (max 128 chars)")
    return value


def _tasks_dir() -> Path:
    return Path(os.getenv("ATTENTION_LEDGER_TASKS_DIR", str(_DEFAULT_TASKS_DIR)))


def _db_path() -> str:
    return os.getenv("ATTENTION_LEDGER_DB_PATH", str(_DEFAULT_DB_PATH))


# Singleton store to avoid repeated _init_db
_ledger_store: Optional[LedgerStore] = None

def _store() -> LedgerStore:
    global _ledger_store
    if _ledger_store is None:
        _ledger_store = LedgerStore(db_path=_db_path())
    return _ledger_store


def _make_agent(baseline_id: str, mock: bool) -> FirstTimeUserAgent:
    """Create an agent with adapter configured from baseline settings."""
    system_prompt = None  # None → agent uses default SYSTEM_PROMPT_V1

    if mock:
        adapter = MockAdapter()
    else:
        store = _store()
        bl = store.get_baseline(baseline_id)
        if bl:
            # bl = (baseline_id, model, engine, system_prompt_hash, temperature, created_at, system_prompt)
            adapter = OllamaAdapter(base_url=settings.ollama_url, model=bl[1], temperature=bl[4])
            if bl[6]:  # system_prompt column
                system_prompt = bl[6]
        else:
            adapter = OllamaAdapter()

    if system_prompt:
        return FirstTimeUserAgent(adapter, system_prompt=system_prompt)
    return FirstTimeUserAgent(adapter)


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# ── Request/Response Models ──

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


class RunRequest(BaseModel):
    baseline_id: str = Field(..., min_length=1, max_length=128, pattern=r'^[a-zA-Z0-9_\-]+$')
    mock: bool = False
    max_steps: Optional[int] = Field(None, ge=1, le=_MAX_STEPS_LIMIT)


class SusSubmission(BaseModel):
    run_id: int = Field(..., ge=1)
    responses: List[int]


class BaselineCreateRequest(BaseModel):
    baseline_id: str = Field(..., min_length=1, max_length=64, pattern=r'^[a-zA-Z0-9_\-]+$')
    model: str = Field("llama3", max_length=64)
    engine: str = Field("ollama", max_length=64)
    temperature: float = Field(0.0, ge=0.0, le=2.0)
    system_prompt: Optional[str] = Field(None, max_length=10000)


class BaselineSummary(BaseModel):
    baseline_id: str
    model: str
    engine: str
    system_prompt_hash: str
    temperature: float
    created_at: str


class ConfigUpdateRequest(BaseModel):
    ollama_url: str = Field(..., max_length=256)
    model_name: str = Field(..., max_length=64)
    temperature: float = Field(..., ge=0.0, le=2.0)


# ── Background task state (in-memory, MVP) ──
active_runs: Dict[str, List[Dict[str, Any]]] = {}
_run_timestamps: Dict[str, float] = {}


def _cleanup_old_runs():
    """Remove stale entries older than TTL."""
    now = time.time()
    expired = [k for k, ts in _run_timestamps.items() if now - ts > _RUN_TTL_SECONDS]
    for k in expired:
        active_runs.pop(k, None)
        _run_timestamps.pop(k, None)


def _resolve_task_file(task_id: str) -> Path:
    """Resolve and validate task file path (prevents path traversal)."""
    _validate_id(task_id, "task_id")
    task_file = _tasks_dir() / f"{task_id}.yaml"
    # Ensure resolved path is within tasks directory
    if not task_file.resolve().is_relative_to(_tasks_dir().resolve()):
        raise HTTPException(status_code=400, detail="Invalid task path")
    return task_file


# ═══════════════════════════════════════════
# Health
# ═══════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok"}


# ═══════════════════════════════════════════
# Dashboard Stats
# ═══════════════════════════════════════════

@app.get("/stats")
def get_stats():
    return _store().get_stats()


# ═══════════════════════════════════════════
# Tasks
# ═══════════════════════════════════════════

@app.get("/tasks", response_model=List[TaskSummary])
def list_tasks():
    tasks = TaskLoader.load_all_from_dir(str(_tasks_dir()))
    return [
        TaskSummary(
            task_id=t.task_id, description=t.description,
            start_condition=t.start_condition, goal_condition=t.goal_condition,
        )
        for t in tasks
    ]


# ═══════════════════════════════════════════
# Task Execution (background)
# ═══════════════════════════════════════════

@app.post("/tasks/{task_id}/run")
async def run_task(task_id: str, payload: RunRequest, background_tasks: BackgroundTasks):
    task_file = _resolve_task_file(task_id)
    if not task_file.exists():
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")

    # Prevent duplicate concurrent runs of the same task
    if task_id in active_runs:
        logs = active_runs[task_id]
        if logs and logs[-1].get("type") not in ("complete", "error", "success"):
            raise HTTPException(status_code=409, detail=f"Task {task_id} is already running")

    # Enforce concurrency limit
    _cleanup_old_runs()
    running_count = sum(
        1 for logs in active_runs.values()
        if logs and logs[-1].get("type") not in ("complete", "error", "success")
    )
    if running_count >= _MAX_CONCURRENT_RUNS:
        raise HTTPException(status_code=429, detail="Too many concurrent runs")

    # Write sentinel BEFORE returning — prevents race with concurrent POSTs
    active_runs[task_id] = [{"type": "queued", "timestamp": _utc_now_iso()}]
    _run_timestamps[task_id] = time.time()

    background_tasks.add_task(
        _run_task_background, task_id, payload.baseline_id, payload.mock, payload.max_steps
    )
    return {"status": "accepted", "task_id": task_id}


async def _run_task_background(task_id: str, baseline_id: str, mock: bool, max_steps: Optional[int]):
    # Sentinel already written by run_task handler; append start event
    async def step_callback(event: Dict[str, Any]):
        event["timestamp"] = _utc_now_iso()
        active_runs[task_id].append(event)
        if mock:
            await asyncio.sleep(0.3)

    agent = _make_agent(baseline_id, mock)
    engine = ExecutionEngine(agent)

    task_file = _resolve_task_file(task_id)
    try:
        task = TaskLoader.load_from_file(str(task_file))
        result = await engine.run_task(task, baseline_id, max_steps=max_steps or 20, step_callback=step_callback)
        _store().save_record(result)
        active_runs[task_id].append({
            "type": "complete", "success": result.success, "timestamp": _utc_now_iso(),
        })
    except Exception as e:
        logger.exception(f"Task {task_id} execution failed")
        active_runs[task_id].append({
            "type": "error", "message": "Task execution failed", "timestamp": _utc_now_iso(),
        })


@app.get("/tasks/{task_id}/status")
def get_task_status(task_id: str):
    _validate_id(task_id, "task_id")
    logs = active_runs.get(task_id, [])
    return {"task_id": task_id, "logs": logs}


# ═══════════════════════════════════════════
# Runs (execution history)
# ═══════════════════════════════════════════

@app.get("/runs", response_model=List[RunSummary])
def list_runs(
    limit: int = Query(50, ge=1, le=500),
    include_metrics: bool = Query(False),
):
    store = _store()
    rows = store.get_recent_records(limit=limit)
    results: List[RunSummary] = []
    for row in rows:
        metrics_payload = None
        if include_metrics and row[11]:
            try:
                metrics_payload = json.loads(row[11])
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(
            RunSummary(
                id=row[0], task_id=row[1], baseline_id=row[2],
                executed_at=row[3], success=bool(row[4]), failure_reason=row[5],
                total_tokens=row[6], input_tokens=row[7], output_tokens=row[8],
                step_count=row[9], retry_count=row[10], metrics=metrics_payload,
            )
        )
    return results


@app.get("/history", response_model=List[RunSummary])
def list_history(limit: int = Query(10, ge=1, le=100), include_metrics: bool = Query(False)):
    return list_runs(limit=limit, include_metrics=include_metrics)


# ═══════════════════════════════════════════
# SUS Submission
# ═══════════════════════════════════════════

@app.post("/sus")
def submit_sus(payload: SusSubmission):
    try:
        score = compute_sus_inspired_score(payload.responses)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    store = _store()
    updated = store.update_sus_by_run_id(payload.run_id, score, payload.responses)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Run id={payload.run_id} not found")
    return {"status": "updated", "run_id": payload.run_id, "sus_inspired_score": score}


# ═══════════════════════════════════════════
# Baselines
# ═══════════════════════════════════════════

@app.get("/baselines", response_model=List[BaselineSummary])
def list_baselines():
    rows = _store().get_all_baselines()
    return [
        BaselineSummary(
            baseline_id=r[0], model=r[1], engine=r[2],
            system_prompt_hash=r[3], temperature=r[4], created_at=r[5],
        )
        for r in rows
    ]


@app.post("/baselines", response_model=BaselineSummary)
def create_baseline(payload: BaselineCreateRequest):
    prompt_hash = hashlib.sha256(
        (payload.system_prompt or "default").encode()
    ).hexdigest()[:16]

    baseline = Baseline(
        baseline_id=payload.baseline_id, model=payload.model,
        engine=payload.engine, system_prompt_hash=prompt_hash,
        temperature=payload.temperature, created_at=_utc_now_iso(),
        system_prompt=payload.system_prompt,
    )
    _store().save_baseline(baseline)
    return BaselineSummary(
        baseline_id=baseline.baseline_id, model=baseline.model,
        engine=baseline.engine, system_prompt_hash=baseline.system_prompt_hash,
        temperature=baseline.temperature, created_at=baseline.created_at,
    )


@app.delete("/baselines/{baseline_id}")
def delete_baseline(baseline_id: str):
    _validate_id(baseline_id, "baseline_id")
    if not _store().delete_baseline(baseline_id):
        raise HTTPException(status_code=404, detail="Baseline not found")
    return {"status": "deleted", "baseline_id": baseline_id}


# ═══════════════════════════════════════════
# Metrics Diff
# ═══════════════════════════════════════════

@app.get("/metrics/diff")
def metrics_diff(
    task_id: str = Query(..., max_length=128, pattern=r'^[a-zA-Z0-9_\-]+$'),
    baseline_a: str = Query(..., max_length=128, pattern=r'^[a-zA-Z0-9_\-]+$'),
    baseline_b: str = Query(..., max_length=128, pattern=r'^[a-zA-Z0-9_\-]+$'),
):
    store = _store()
    rows_a = store.get_records_by_task_and_baseline(task_id, baseline_a)
    rows_b = store.get_records_by_task_and_baseline(task_id, baseline_b)

    if not rows_a:
        raise HTTPException(status_code=404, detail=f"No records for baseline_a={baseline_a}")
    if not rows_b:
        raise HTTPException(status_code=404, detail=f"No records for baseline_b={baseline_b}")

    def _avg(rows, idx):
        vals = [r[idx] for r in rows]
        return sum(vals) / len(vals) if vals else 0

    avg_a = {
        "total_tokens": _avg(rows_a, 6), "input_tokens": _avg(rows_a, 7),
        "output_tokens": _avg(rows_a, 8), "step_count": _avg(rows_a, 9),
        "retry_count": _avg(rows_a, 10), "run_count": len(rows_a),
    }
    avg_b = {
        "total_tokens": _avg(rows_b, 6), "input_tokens": _avg(rows_b, 7),
        "output_tokens": _avg(rows_b, 8), "step_count": _avg(rows_b, 9),
        "retry_count": _avg(rows_b, 10), "run_count": len(rows_b),
    }

    delta = {}
    for key in ["total_tokens", "input_tokens", "output_tokens", "step_count", "retry_count"]:
        delta[key] = avg_b[key] - avg_a[key]
        pct = ((avg_b[key] - avg_a[key]) / avg_a[key] * 100) if avg_a[key] else 0
        delta[f"{key}_pct"] = round(pct, 2)

    return {
        "task_id": task_id,
        "baseline_a": {"id": baseline_a, **avg_a},
        "baseline_b": {"id": baseline_b, **avg_b},
        "delta": delta,
    }


# ═══════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════

@app.get("/config")
def get_config():
    return {
        "ollama_url": settings.ollama_url,
        "model_name": settings.model_name,
        "temperature": settings.temperature,
    }


@app.put("/config")
def update_config(req: ConfigUpdateRequest):
    # SSRF protection: only allow localhost URLs
    parsed = urlparse(req.ollama_url)
    if parsed.hostname not in _ALLOWED_OLLAMA_HOSTS:
        raise HTTPException(status_code=400, detail="Only localhost URLs are allowed for Ollama")
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    settings.ollama_url = req.ollama_url
    settings.model_name = req.model_name
    settings.temperature = req.temperature
    return {"status": "updated", "config": get_config()}
