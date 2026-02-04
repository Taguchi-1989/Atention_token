from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import os
import sys
from datetime import datetime

# Ensure core modules are found
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from attention_ledger.core.task.loader import TaskLoader
from attention_ledger.core.ledger.store import LedgerStore
from attention_ledger.core.llm.adapter import OllamaAdapter
from attention_ledger.core.llm.mock_adapter import MockAdapter
from attention_ledger.core.agent.agent import FirstTimeUserAgent
from attention_ledger.core.execute.engine import ExecutionEngine
from attention_ledger.core.task.model import TaskScenario

app = FastAPI(title="Attention Ledger API")

# Global dependencies
ledger = LedgerStore()

class TaskRunRequest(BaseModel):
    baseline_id: str
    mock: bool = False

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Attention Ledger Local"}

@app.get("/tasks")
def list_tasks():
    # Load tasks from tasks directory
    tasks_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tasks")
    try:
        tasks = TaskLoader.load_all_from_dir(tasks_dir)
        return tasks
    except Exception as e:
        return {"error": str(e), "tasks": []}

@app.get("/history")
def get_history(limit: int = 20):
    rows = ledger.get_recent_records(limit)
    # Convert tuple to dict
    history = []
    for row in rows:
        # Schema: id, task_id, baseline_id, executed_at, success, failure_reason, total_tokens...
        history.append({
            "id": row[0],
            "task_id": row[1],
            "baseline_id": row[2],
            "executed_at": row[3],
            "success": bool(row[4]),
            "failure_reason": row[5],
            "total_tokens": row[6],
            "metrics": row[11] # metrics_json
        })
    return history

# Global state for running tasks (simple in-memory store for MVP)
active_runs: Dict[str, List[Dict[str, Any]]] = {}

@app.get("/tasks/{task_id}/status")
def get_task_status(task_id: str):
    """
    Returns the execution logs for an active task.
    If task is not in active_runs, it might be finished or not started.
    """
    # For MVP, we use task_id as run_key.
    # In real app, we should use a unique run_id returned by POST /run
    logs = active_runs.get(task_id, [])
    # Check if task is finished? 
    # For now, client just polls until it sees 'success' or 'error' event in logs
    # or stops receiving updates.
    return {"task_id": task_id, "logs": logs}

async def _run_task_background(task_id: str, baseline_id: str, mock: bool):
    print(f"Background: Running {task_id}")
    
    # Initialize log buffer
    active_runs[task_id] = []

    async def step_callback(event: Dict[str, Any]):
        # Append timestamp
        event["timestamp"] = datetime.utcnow().isoformat()
        active_runs[task_id].append(event)
        # Small sleep to simulate real-time feel if mock is too fast
        if mock:
             await asyncio.sleep(0.5)

    # 1. Adapter
    if mock:
        adapter = MockAdapter()
    else:
        # Pass nothing so it uses current global settings
        adapter = OllamaAdapter()
    
    agent = FirstTimeUserAgent(adapter)
    
    # 2. Load Task
    tasks_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tasks")
    task_file = os.path.join(tasks_dir, f"{task_id}.yaml")
    
    try:
        task = TaskLoader.load_from_file(task_file)
    except Exception as e:
        err_msg = f"Failed to load task: {e}"
        print(err_msg)
        active_runs[task_id].append({"type": "error", "message": err_msg})
        return

    # 3. Engine
    engine = ExecutionEngine(agent)
    
    # 4. Run & Save
    try:
        result = await engine.run_task(task, baseline_id, step_callback=step_callback)
        ledger.save_record(result)
        print(f"Background: Task {task_id} finished. Success: {result.success}")
    except Exception as e:
        print(f"Background error: {e}")
        active_runs[task_id].append({"type": "error", "message": str(e)})
    
    # Cleanup logs after some time? For now keep them until restart or overwrite
    # active_runs.pop(task_id, None) # Don't pop immediately so client can see final state


from ..metrics.sus import compute_sus_inspired_score

class SusSubmissionRequest(BaseModel):
    task_id: str
    baseline_id: str
    responses: List[int] # 10 integers, 1-5

@app.post("/sus")
def submit_sus_score(req: SusSubmissionRequest):
    # ... (existing code) ...
    return {"status": "success", "sus_score": score}

# Configuration Endpoints
from ..core.llm.mock_adapter import settings

class ConfigUpdateRequest(BaseModel):
    ollama_url: str
    model_name: str
    temperature: float

@app.get("/config")
def get_config():
    return {
        "ollama_url": settings.ollama_url,
        "model_name": settings.model_name,
        "temperature": settings.temperature
    }

@app.put("/config")
def update_config(req: ConfigUpdateRequest):
    settings.ollama_url = req.ollama_url
    settings.model_name = req.model_name
    settings.temperature = req.temperature
    return {"status": "updated", "config": get_config()}

@app.post("/tasks/{task_id}/run")
async def run_task_endpoint(task_id: str, req: TaskRunRequest, background_tasks: BackgroundTasks):
    # Validate task existence
    tasks_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tasks")
    task_file = os.path.join(tasks_dir, f"{task_id}.yaml")
    
    if not os.path.exists(task_file):
        raise HTTPException(status_code=404, detail="Task not found")

    background_tasks.add_task(_run_task_background, task_id, req.baseline_id, req.mock)
    
    return {"status": "accepted", "message": f"Task {task_id} queued for execution"}
