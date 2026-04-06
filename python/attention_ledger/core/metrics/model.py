from pydantic import BaseModel
from typing import List, Optional

class CoreMetrics(BaseModel):
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    step_count: int = 0
    retry_count: int = 0
    cognitive_load_score: Optional[float] = None  # Composite score
    sus_inspired_score: Optional[float] = None
    sus_inspired_responses: Optional[List[int]] = None

    def compute_cognitive_load(self) -> float:
        """Composite score: output_tokens + step_count * 100 + retry_count * 500.
        Higher = more cognitive load (harder UI).
        """
        score = float(self.output_tokens + self.step_count * 100 + self.retry_count * 500)
        self.cognitive_load_score = score
        return score
