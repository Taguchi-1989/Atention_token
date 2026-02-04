# Python Core

## Setup (pip + venv)

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Run API

```bash
uvicorn attention_ledger.api.main:app --reload
```

## API (read-only MVP)

- `GET /health`
- `GET /tasks`
- `GET /runs?limit=10`
- `GET /runs?limit=10&include_metrics=true`
- `POST /sus`

### Environment

- `ATTENTION_LEDGER_TASKS_DIR` (default: `python/tasks`)
- `ATTENTION_LEDGER_DB_PATH` (default: `python/ledger.db`)
