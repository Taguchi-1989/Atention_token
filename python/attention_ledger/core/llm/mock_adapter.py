```python
from typing import Optional
from .adapter import LLMAdapter
from .models import LLMResponse, TokenUsage
import json

class Settings:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Settings, cls).__new__(cls)
            cls._instance.ollama_url = "http://localhost:11434"
            cls._instance.model_name = "llama3"
            cls._instance.temperature = 0.7
        return cls._instance

settings = Settings()

class MockAdapter(LLMAdapter):
    def get_token_usage_cost(self, usage: TokenUsage) -> float:
        # Mock adapters typically don't incur real costs, so return 0
        return 0.0

    """
    A mock adapter that returns predefined responses for testing 
    without a running LLM.
    """
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        # Simulate a simple decision based on keyword matching or random
        content = json.dumps({
            "action": "input", 
            "target": "expense_field", 
            "confidence": "high", 
            "note": "Mocking input action for testing"
        })
        
        # If the prompt suggests we are at the end or goal
        if "goal" in prompt.lower() or "submit" in prompt.lower():
             content = json.dumps({
                "action": "done", 
                "target": "submit_button", 
                "confidence": "high", 
                "note": "Goal achieved in mock"
            })

        return LLMResponse(
            content=content,
            usage=TokenUsage(input_tokens=50, output_tokens=20, total_tokens=70),
            raw_response={"mock": True}
        )
