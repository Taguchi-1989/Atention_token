from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from typing import Dict, Any, Optional, List
import httpx
import json
from .models import LLMResponse, TokenUsage
from .mock_adapter import settings # Import the singleton settings

class LLMAdapter(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        pass

class OllamaAdapter(LLMAdapter):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        # Use settings if provided params are None
        self.base_url = base_url or settings.ollama_url
        self.model = model or settings.model_name

    async def generate(self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7) -> LLMResponse:
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                
                content = data.get("response", "")
                
                # Ollama returns explicit token counts if available
                input_tokens = data.get("prompt_eval_count", 0)
                output_tokens = data.get("eval_count", 0)
                
                usage = TokenUsage(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens
                )
                
                return LLMResponse(
                    content=content,
                    usage=usage,
                    raw_response=data
                )
            except Exception as e:
                # In a real app, we should log this and maybe re-raise a custom exception
                raise e
