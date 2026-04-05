from pydantic import BaseModel
from typing import Dict, Any, Optional

class TaskScenario(BaseModel):
    task_id: str
    description: str
    start_condition: str
    goal_condition: str
    input_data: Dict[str, Any]
    url: Optional[str] = None  # If set, use PlaywrightSimulator instead of SimpleWebSimulator
