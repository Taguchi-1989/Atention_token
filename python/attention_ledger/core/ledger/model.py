from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..metrics.model import CoreMetrics

class LedgerRecord(BaseModel):
    task_id: str
    baseline_id: str
    executed_at: str # ISO format
    metrics: CoreMetrics
    success: bool
    failure_reason: Optional[str] = None

class Baseline(BaseModel):
    baseline_id: str
    model: str
    engine: str
    system_prompt_hash: str
    temperature: float
    created_at: str # ISO format
