# Python Core

## Setup (pip + venv)

```bash
python -m venv .venv             # Windowsで複数Pythonがある場合: py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.lock
```

## Run API

```bash
uvicorn attention_ledger.api.main:app --reload
```

## API

- `GET /api/health`
- `GET /api/tasks`
- `GET /api/runs?limit=10`
- `GET /api/runs?limit=10&include_metrics=true`
- `POST /api/sus`
- `/api/talkbalancer/*`

### Environment

- `ATTENTION_LEDGER_TASKS_DIR` (default: `python/tasks`)
- `ATTENTION_LEDGER_DB_PATH` (default: `python/ledger.db`)
