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
    
    # 2. Load Task - resolve path from task_id or direct file path
    if os.path.exists(args.task_id):
        task_file = args.task_id
    elif os.path.exists(f"tasks/{args.task_id}.yaml"):
        task_file = f"tasks/{args.task_id}.yaml"
    elif os.path.exists(f"tasks/{args.task_id}"):
        task_file = f"tasks/{args.task_id}"
    else:
        task_file = f"tasks/{args.task_id}.yaml"

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
    import hashlib
    from attention_ledger.core.ledger.model import Baseline
    from datetime import datetime, timezone

    prompt_hash = hashlib.sha256(
        (args.system_prompt or "default").encode()
    ).hexdigest()[:16]

    baseline = Baseline(
        baseline_id=args.baseline_id,
        model=args.model,
        engine=args.engine,
        system_prompt_hash=prompt_hash,
        temperature=args.temperature,
        created_at=datetime.now(tz=timezone.utc).isoformat(),
    )

    ledger = LedgerStore()
    ledger.save_baseline(baseline)
    print(f"Baseline created: {baseline.baseline_id}")
    print(f"  model={baseline.model}, engine={baseline.engine}, temp={baseline.temperature}")
    print(f"  prompt_hash={prompt_hash}")

async def cmd_report_diff(args):
    ledger = LedgerStore()
    rows_a = ledger.get_records_by_task_and_baseline(args.task, args.A)
    rows_b = ledger.get_records_by_task_and_baseline(args.task, args.B)

    if not rows_a:
        print(f"No records found for task={args.task}, baseline={args.A}")
        return
    if not rows_b:
        print(f"No records found for task={args.task}, baseline={args.B}")
        return

    def avg(rows, idx):
        vals = [r[idx] for r in rows]
        return sum(vals) / len(vals) if vals else 0

    print(f"\n--- Diff Report: {args.task} ---")
    print(f"Baseline A: {args.A} ({len(rows_a)} runs)")
    print(f"Baseline B: {args.B} ({len(rows_b)} runs)")
    print()

    headers = [
        ("total_tokens", 6), ("input_tokens", 7), ("output_tokens", 8),
        ("step_count", 9), ("retry_count", 10),
    ]
    print(f"{'Metric':<16} {'A':>10} {'B':>10} {'Delta':>10} {'%':>8}")
    print("-" * 56)
    for name, idx in headers:
        va, vb = avg(rows_a, idx), avg(rows_b, idx)
        delta = vb - va
        pct = (delta / va * 100) if va else 0
        sign = "+" if delta > 0 else ""
        print(f"{name:<16} {va:>10.1f} {vb:>10.1f} {sign}{delta:>9.1f} {sign}{pct:>7.1f}%")

def main():
    parser = argparse.ArgumentParser(description="Attention Ledger CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # baseline create
    p_baseline = subparsers.add_parser("baseline", help="Baseline management")
    sp_baseline = p_baseline.add_subparsers(dest="subcommand", required=True)
    p_bl_create = sp_baseline.add_parser("create", help="Create new baseline")
    p_bl_create.add_argument("baseline_id", help="Baseline ID (e.g. BL-2026-H1)")
    p_bl_create.add_argument("--model", default="llama3", help="Model name")
    p_bl_create.add_argument("--engine", default="ollama", help="Engine")
    p_bl_create.add_argument("--temperature", type=float, default=0.0, help="Temperature")
    p_bl_create.add_argument("--system-prompt", default=None, help="System prompt text")

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
