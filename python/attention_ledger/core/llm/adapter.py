import logging
from abc import ABC, abstractmethod
from typing import Optional
import httpx
from .models import LLMResponse, TokenUsage
from .config import settings

logger = logging.getLogger(__name__)


class LLMAdapter(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        pass

    def get_token_usage_cost(self, usage: TokenUsage) -> float:
        return 0.0


class OllamaAdapter(LLMAdapter):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None, temperature: Optional[float] = None):
        self.base_url = base_url or settings.ollama_url
        self.model = model or settings.model_name
        self.temperature = temperature if temperature is not None else settings.temperature
        self._client = httpx.AsyncClient(timeout=60.0)

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> LLMResponse:
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": self.temperature},
        }
        if system_prompt:
            payload["system"] = system_prompt

        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

        content = data.get("response", "")
        input_tokens = data.get("prompt_eval_count", 0)
        output_tokens = data.get("eval_count", 0)

        return LLMResponse(
            content=content,
            usage=TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
            ),
            raw_response=data,
        )

    async def close(self):
        await self._client.aclose()

    def get_token_usage_cost(self, usage: TokenUsage) -> float:
        return 0.0
