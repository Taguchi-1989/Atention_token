from pydantic import BaseModel
from typing import Optional, Dict, Any

class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int

class LLMResponse(BaseModel):
    content: str
    usage: TokenUsage
    raw_response: Optional[Dict[str, Any]] = None
