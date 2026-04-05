from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel
from ..llm.adapter import LLMAdapter
from ..llm.models import LLMResponse
from .prompts import SYSTEM_PROMPT_V1

class AgentAction(BaseModel):
    action: str
    target: Optional[str] = None
    value: Optional[str] = None
    confidence: str
    note: str

class FirstTimeUserAgent:
    def __init__(self, adapter: LLMAdapter, system_prompt: str = SYSTEM_PROMPT_V1):
        self.adapter = adapter
        self.system_prompt = system_prompt
        self.history: List[Dict[str, Any]] = []

    async def decide_next_action(self, current_state_description: str) -> AgentAction:
        """
        Decides the next action based on the current state (e.g. screen description).
        """
        # Build context from history
        context = ""
        last_actions = self.history[-3:] # Keep context concise
        if last_actions:
            context = "History of recent actions:\n"
            for item in last_actions:
                action_data = item['action']
                context += f"- Action: {action_data.get('action')} target={action_data.get('target', 'N/A')}\n"
        else:
            context = "No previous actions. This is the start of the task."
        
        prompt = f"""
{context}

Current Screen State:
{current_state_description}

Decide your next action based on the screen state and your goal.
Return ONLY valid JSON.
"""
        response: LLMResponse = await self.adapter.generate(prompt, system_prompt=self.system_prompt)
        
        # Parse JSON
        try:
            # Simple heuristic to extract JSON if the model adds markdown code blocks
            content = response.content.strip()
            if content.startswith("```json"):
                content = content.replace("```json", "", 1) # Replace first occurrence
                if content.endswith("```"):
                    content = content[:-3]
            elif content.startswith("```"):
                content = content.replace("```", "", 1)
                if content.endswith("```"):
                    content = content[:-3]
            
            content = content.strip()
            # Handle potential multiple JSONs or trailing text? For now assume clean output
            
            data = json.loads(content)
            action = AgentAction(**data)
            
            # Record history
            self.history.append({
                "action": action.model_dump(),
                "raw_response": response.content,
                "token_usage": response.usage.model_dump()
            })

            return action
        except (json.JSONDecodeError, ValueError) as e:
            # Record failed attempt so token usage is still tracked
            fallback = AgentAction(
                action="retry",
                confidence="low",
                note=f"Failed to parse JSON response: {str(e)}"
            )
            self.history.append({
                "action": fallback.model_dump(),
                "raw_response": response.content,
                "token_usage": response.usage.model_dump()
            })
            return fallback
