import argparse
import asyncio
import sys
import os
import traceback

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from attention_ledger.core.llm.adapter import OllamaAdapter
from attention_ledger.core.llm.mock_adapter import MockAdapter
from attention_ledger.core.agent.agent import FirstTimeUserAgent
from attention_ledger.core.task.loader import TaskLoader
from attention_ledger.core.execute.engine import ExecutionEngine
from attention_ledger.core.ledger.store import LedgerStore

async def cmd_task_run(args):
    print(f"Running task {args.task_id} with baseline {args.baseline}...")
    
    # 1. Setup Adapter (Mock or Real)
    if args.mock:
        print("!! USING MOCK ADAPTER (No LLM) !!")
        adapter = MockAdapter()
    else:
        # Check connection or just try
        adapter = OllamaAdapter() 
        
    agent = FirstTimeUserAgent(adapter)
    
    # 2. Load Task
    task_file = f"tasks/{args.task_id}.yaml" 
    # Handle if extension is already provided or path logic (simplified from previous step)
    if not task_file.endswith(".yaml") and not os.path.exists(task_file):
         if os.path.exists(f"tasks/{args.task_id}.yaml"):
             task_file = f"tasks/{args.task_id}.yaml"
         elif os.path.exists(args.task_id):
             task_file = args.task_id

    try:
        task = TaskLoader.load_from_file(task_file)
        print(f"Loaded task: {task.description}")
    except Exception as e:
        print(f"Failed to load task '{task_file}': {e}")
        # Only allow TEST-CHECK fallback if specifically requested or file missing
        if args.task_id == "TEST-CHECK":
             from attention_ledger.core.task.model import TaskScenario
             task = TaskScenario(
                task_id="TEST-CHECK",
                description="Mock Task",
                start_condition="Start",
                goal_condition="End",
                input_data={}
             )
        else:
            return

    # 3. Setup Engine & Ledger
    engine = ExecutionEngine(agent)
    ledger = LedgerStore() # defaults to 'ledger.db' in current dir
    
    # 4. Run
    try:
        print("Initializing Agent Loop...")
        sus_responses = None
        if args.sus is not None:
            try:
                sus_responses = [int(v.strip()) for v in args.sus.split(",") if v.strip()]
            except ValueError:
                print("Invalid SUS responses. Use comma-separated integers (1-5).")
                return

        result = await engine.run_task(task, args.baseline, sus_responses=sus_responses)
        
        print("\n--- Execution Result ---")
        print(f"Success: {result.success}")
        print(f"Metrics: {result.metrics}")
        
        # 5. Save Record
        ledger.save_record(result)
        
    except Exception as e:
        print(f"Fatal Error during execution: {e}")
        traceback.print_exc()

async def cmd_report_history(args):
    ledger = LedgerStore()
    rows = ledger.get_recent_records()
    print(f"\n--- Recent Execution History ({len(rows)}) ---")
    for row in rows:
        # specific to schema: id, task_id, baseline_id, executed_at, success...
        print(f"[{row[3]}] Task: {row[1]} | Baseline: {row[2]} | Success: {row[4]} | Tokens: {row[6]}")

async def cmd_baseline_create(args):
    print("Creating baseline... (Not implemented)")

async def cmd_report_diff(args):
    print(f"Reporting diff for task {args.task} between {args.A} and {args.B}...")

def main():
    parser = argparse.ArgumentParser(description="Attention Ledger CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # baseline create
    p_baseline = subparsers.add_parser("baseline", help="Baseline management")
    sp_baseline = p_baseline.add_subparsers(dest="subcommand", required=True)
    sp_baseline.add_parser("create", help="Create new baseline")

    # task run
    p_task = subparsers.add_parser("task", help="Task execution")
    sp_task = p_task.add_subparsers(dest="subcommand", required=True)
    p_run = sp_task.add_parser("run", help="Run a task")
    p_run.add_argument("task_id", help="Task ID or YAML path")
    p_run.add_argument("--baseline", required=True, help="Baseline ID")
    p_run.add_argument("--mock", action="store_true", help="Use mock adapter instead of real LLM")
    p_run.add_argument(
        "--sus",
        help="SUS-inspired responses (10 numbers, 1-5) e.g. 3,2,4,2,4,3,4,2,5,2",
    )

    # report (diff & history)
    p_report = subparsers.add_parser("report", help="Reporting")
    sp_report = p_report.add_subparsers(dest="subcommand", required=True)
    
    p_diff = sp_report.add_parser("diff", help="Diff report")
    p_diff.add_argument("--task", required=True, help="Task ID")
    p_diff.add_argument("--A", required=True, help="Baseline A")
    p_diff.add_argument("--B", required=True, help="Baseline B")

    p_hist = sp_report.add_parser("history", help="Show recent history")

    args = parser.parse_args()

    if args.command == "baseline" and args.subcommand == "create":
        asyncio.run(cmd_baseline_create(args))
    elif args.command == "task" and args.subcommand == "run":
        asyncio.run(cmd_task_run(args))
    elif args.command == "report":
        if args.subcommand == "diff":
            asyncio.run(cmd_report_diff(args))
        elif args.subcommand == "history":
            asyncio.run(cmd_report_history(args))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
