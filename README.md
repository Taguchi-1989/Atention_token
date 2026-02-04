# Attention Ledger Local

Measure attention cost by using local LLM agents as a proxy for first-time users.

## Status

**MVP Implementation Started.**
Core logic (Agent, Task, Execution Engine) and CLI stub are implemented in Python.

## Prerequisites

- Python 3.10+
- Ollama (running locally on port 11434 with `llama3` or similar)

## Quick Start

1. **Install Dependencies**

   ```bash
   cd python
   pip install -r requirements.txt
   ```

2. **Run The CLI**
   Run the test task (requires Ollama):
   ```bash
   python -m attention_ledger.cli.main task run TEST-TASK --baseline BL-DEMO
   ```

## Structure

- `docs/` specs and roadmap
- `src/` Next.js UI (Planned)
- `python/` Core logic and CLI
  - `attention_ledger/core/agent`: First-time user agent logic
  - `attention_ledger/core/execute`: Task execution loop
  - `attention_ledger/cli`: Command line interface

## Implementation Notes

Use `python -m attention_ledger.cli.main` to access the CLI.
Currently supports running a mock task against a local Ollama instance.

## コンプライアンス

See `docs/COMPLIANCE_AND_BACKGROUND.md`.
