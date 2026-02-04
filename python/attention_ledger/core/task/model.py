from pydantic import BaseModel
from typing import Dict, Any

class TaskScenario(BaseModel):
    task_id: str
    description: str
    start_condition: str
    goal_condition: str
    input_data: Dict[str, Any]
