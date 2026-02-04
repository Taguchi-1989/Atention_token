from pydantic import BaseModel
from typing import List, Optional

class CoreMetrics(BaseModel):
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    step_count: int = 0
    retry_count: int = 0
    sus_inspired_score: Optional[float] = None
    sus_inspired_responses: Optional[List[int]] = None
