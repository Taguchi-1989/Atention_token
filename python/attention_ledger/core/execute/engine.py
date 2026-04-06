from typing import List, Optional, Callable
from ..agent.agent import FirstTimeUserAgent, AgentAction
from ..task.model import TaskScenario
from ..metrics.model import CoreMetrics
from ..metrics.sus import compute_sus_inspired_score
from ..ledger.model import LedgerRecord
from datetime import datetime, timezone
import os
from .simulator import SimpleWebSimulator
from .playwright_simulator import PlaywrightSimulator


class ExecutionEngine:
    def __init__(self, agent: FirstTimeUserAgent):
        self.agent = agent

    def _load_simulator(self, task_id: str) -> Optional[SimpleWebSimulator]:
        """Try to find corresponding HTML file in tasks dir."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        html_path = os.path.join(base_dir, "tasks", f"{task_id.lower()}.html")

        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                return SimpleWebSimulator(f.read())
        return None

    async def run_task(
        self,
        task: TaskScenario,
        baseline_id: str,
        max_steps: int = 20,
        sus_responses: Optional[List[int]] = None,
        step_callback: Optional[Callable] = None,
    ) -> LedgerRecord:
        metrics = CoreMetrics()

        # Choose simulator based on whether task has a URL
        playwright_sim: Optional[PlaywrightSimulator] = None
        simulator: Optional[SimpleWebSimulator] = None

        if task.url:
            playwright_sim = PlaywrightSimulator()
            await playwright_sim.start(task.url)
            current_state = (
                f"GOAL: {task.description}\n\n"
                f"[SCREEN CONTENT]\n{playwright_sim.get_visible_text()}"
            )
        else:
            simulator = self._load_simulator(task.task_id)
            if simulator:
                current_state = f"GOAL: {task.description}\n\n[SCREEN CONTENT]\n{simulator.get_visible_text()}"
            else:
                current_state = f"Task: {task.description}. Start Condition: {task.start_condition}. You see the screen."

        success = False
        failure_reason = None

        print(f"Starting execution for Task: {task.task_id}")
        if step_callback:
            await step_callback({"type": "start", "message": f"Starting task: {task.task_id}"})

        try:
            for step in range(1, max_steps + 1):
                metrics.step_count = step
                print(f"--- Step {step} ---")
                if step_callback:
                    await step_callback({"type": "step", "step": step, "message": "Agent thinking..."})

                # 1. Agent Decision (with screenshot for vision models)
                try:
                    screenshot_data = None
                    if playwright_sim is not None:
                        screenshot_data = await playwright_sim.take_screenshot()
                    action: AgentAction = await self.agent.decide_next_action(
                        current_state, screenshot=screenshot_data
                    )
                except Exception as e:
                    failure_reason = f"Agent Error: {str(e)}"
                    break

                # Update Metrics
                if self.agent.history:
                    last_history = self.agent.history[-1]
                    last_usage = last_history.get('token_usage', {})
                    metrics.input_tokens += last_usage.get('input_tokens', 0)
                    metrics.output_tokens += last_usage.get('output_tokens', 0)
                    metrics.total_tokens += last_usage.get('total_tokens', 0)

                # 2. Execute Action
                print(f"Action: {action.action} | Target: {action.target} | Note: {action.note}")

                action_success = True

                if playwright_sim is not None:
                    if action.action in ['input', 'click', 'select', 'scroll']:
                        valid = await playwright_sim.execute_action(
                            action.action, action.target or "", action.value
                        )
                        if not valid and action.action != 'done':
                            action_success = False
                            current_state = (
                                f"ERROR: Element '{action.target}' not found. "
                                f"Please check the screen content again.\n\n"
                                f"[SCREEN CONTENT]\n{playwright_sim.get_visible_text()}"
                            )
                        else:
                            current_state = (
                                f"GOAL: {task.description}\n\n"
                                f"[SCREEN CONTENT]\n{playwright_sim.get_visible_text()}"
                            )
                elif simulator is not None:
                    if action.action in ['input', 'click']:
                        valid = simulator.execute_action(action.action, action.target, action.value)
                        if not valid and action.action != 'done':
                            action_success = False
                            current_state = (
                                f"ERROR: Element '{action.target}' not found via ID. "
                                f"Please check the screen content again.\n\n"
                                f"[SCREEN CONTENT]\n{simulator.get_visible_text()}"
                            )
                        else:
                            current_state = f"GOAL: {task.description}\n\n[SCREEN CONTENT]\n{simulator.get_visible_text()}"

                if step_callback:
                    await step_callback({
                        "type": "action",
                        "step": step,
                        "action": action.action,
                        "target": action.target,
                        "note": action.note,
                        "confidence": action.confidence,
                        "simulated": simulator is not None or playwright_sim is not None,
                    })

                # 3. Check Success / Goal
                if action.action == "done":
                    success = True
                    print("Goal Achieved!")
                    if step_callback:
                        await step_callback({"type": "success", "message": "Goal Achieved!"})
                    break

                elif action.action == "retry" or not action_success:
                    metrics.retry_count += 1
                    if simulator is None and playwright_sim is None:
                        current_state = f"Previous action failed. Screen state unchanged. {current_state}"

                elif simulator is None and playwright_sim is None:
                    current_state = f"You performed {action.action} on {action.target}. The screen updated."

                if step == max_steps:
                    failure_reason = "Max steps reached"
                    print("Max steps reached - Task Failed.")
                    if step_callback:
                        await step_callback({"type": "error", "message": "Max steps reached"})
        finally:
            if playwright_sim is not None:
                await playwright_sim.close()

        # Compute composite cognitive load score
        metrics.compute_cognitive_load()

        if sus_responses is not None:
            metrics.sus_inspired_score = compute_sus_inspired_score(sus_responses)
            metrics.sus_inspired_responses = sus_responses

        if failure_reason and step_callback:
            await step_callback({"type": "error", "message": failure_reason})

        return LedgerRecord(
            task_id=task.task_id,
            baseline_id=baseline_id,
            executed_at=datetime.now(tz=timezone.utc).isoformat(),
            metrics=metrics,
            success=success,
            failure_reason=failure_reason,
        )
