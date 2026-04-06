from typing import Optional
from .adapter import LLMAdapter
from .models import LLMResponse, TokenUsage
import json


# Predefined mock action sequence to simulate multi-step task execution
_MOCK_ACTIONS = [
    {"action": "click", "target": "start_button", "confidence": "medium", "note": "Starting the task"},
    {"action": "input", "target": "date_field", "confidence": "high", "note": "Entering date value"},
    {"action": "input", "target": "amount_field", "confidence": "high", "note": "Entering amount"},
    {"action": "input", "target": "description_field", "confidence": "medium", "note": "Filling description"},
    {"action": "click", "target": "submit_button", "confidence": "high", "note": "Submitting the form"},
    {"action": "done", "target": "confirmation", "confidence": "high", "note": "Task completed successfully"},
]


class MockAdapter(LLMAdapter):
    """
    A mock adapter that returns a sequence of predefined actions for testing
    without a running LLM. Simulates realistic multi-step task execution.
    """

    def __init__(self):
        self._call_count = 0

    def get_token_usage_cost(self, usage: TokenUsage) -> float:
        return 0.0

    async def generate(self, prompt: str, system_prompt: Optional[str] = None,
                       images=None) -> LLMResponse:
        # Pick action from sequence; last action repeats if exceeded
        idx = min(self._call_count, len(_MOCK_ACTIONS) - 1)
        action = _MOCK_ACTIONS[idx]
        self._call_count += 1

        # Vary token counts slightly per step for realistic metrics
        input_tokens = 40 + self._call_count * 10
        output_tokens = 15 + self._call_count * 5
        content = json.dumps(action)

        return LLMResponse(
            content=content,
            usage=TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
            ),
            raw_response={"mock": True, "step": self._call_count}
        )
