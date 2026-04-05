# Attention Ledger

**Measure the cognitive load of any UI — automatically, using AI agents.**

Attention Ledger sends a simulated first-time user (an LLM agent) to complete tasks on a web interface. The number of tokens the agent consumes while navigating and reasoning is used as a proxy for **cognitive complexity**: a confusing UI costs more tokens than a clear one. Compare two versions of the same screen and you get an objective, reproducible usability delta.

---

## Why it works

| Signal                 | Interpretation                                             |
| ---------------------- | ---------------------------------------------------------- |
| High token consumption | Agent struggled — many re-reads, ambiguous affordances     |
| Low token consumption  | Agent succeeded quickly — clear labels, logical flow       |
| Step count             | How many interactions were needed                          |
| Failure reason         | What specifically confused the agent                       |

---

## Architecture

```text
┌─────────────────────────────────────────┐
│              Browser / Tester           │
└───────────────┬────────────────────────┘
                │  HTTP (port 3000)
┌───────────────▼────────────────────────┐
│         Next.js Frontend (src/)        │
│  Dashboard · Task Runner · SUS Form    │
└───────────────┬────────────────────────┘
                │  HTTP (port 8000)
┌───────────────▼────────────────────────┐
│       FastAPI Backend (python/)        │
│  /tasks  /runs  /sus  /health          │
└───────┬──────────────────┬─────────────┘
        │                  │
┌───────▼──────┐   ┌───────▼──────────────┐
│  SQLite DB   │   │   Ollama / Mock LLM   │
│  ledger.db   │   │  (port 11434)         │
└──────────────┘   └──────────────────────┘
```

---

## Quick Start (Docker)

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone
git clone https://github.com/your-org/attention-ledger.git
cd attention-ledger

# 2. Configure (optional — defaults work for local Ollama)
cp .env.example .env

# 3. Start everything
docker compose up --build

# 4. Open the dashboard
open http://localhost:3000
```

> The API is available at <http://localhost:8000>
> Interactive API docs: <http://localhost:8000/docs>

To use a real LLM, install [Ollama](https://ollama.ai), pull a model, and set `OLLAMA_URL` in `.env`:

```bash
ollama pull llama3
```

---

## Manual Setup

### Python Backend

```bash
cd python
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start the API server
uvicorn attention_ledger.api.main:app --port 8000 --reload
```

Environment variables (optional — all have defaults):

| Variable                        | Default                         | Description           |
| ------------------------------- | ------------------------------- | --------------------- |
| `OLLAMA_URL`                    | `http://localhost:11434`        | Ollama endpoint       |
| `OLLAMA_MODEL`                  | `llama3`                        | Model name            |
| `ATTENTION_LEDGER_DB_PATH`      | `python/ledger.db`              | SQLite path           |
| `ATTENTION_LEDGER_TASKS_DIR`    | `python/tasks`                  | Task YAML directory   |

### Next.js Frontend

```bash
cd src
npm install
npm run dev       # http://localhost:3000
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in `src/.env.local` if the API runs on a different host.

---

## Running a Task

### Via the dashboard

1. Open <http://localhost:3000>
2. Click a task card
3. Toggle **Mock Mode** (no Ollama needed) or leave off for real LLM
4. Click **Run** and watch the live log

### Via the API

```bash
# List available tasks
curl http://localhost:8000/tasks

# Run a task in mock mode
curl -X POST http://localhost:8000/tasks/EXPENSE_INPUT_V1/run \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "demo", "mock": true}'

# View run history
curl "http://localhost:8000/runs?limit=10&include_metrics=true"
```

---

## Demo A/B Scenarios

Three pairs of HTML pages are included in `python/tasks/` to demonstrate the measurement in action.

| Pair          | Bad (v1)                   | Good (v2)                  | Description                       |
| ------------- | -------------------------- | -------------------------- | --------------------------------- |
| Expense form  | `expense_v1.html`          | `expense_v2.html`          | Travel expense claim              |
| Shopping cart | `shopping_cart_v1.html`    | `shopping_cart_v2.html`    | EC product search + add to cart   |
| Inquiry form  | `inquiry_form_v1.html`     | `inquiry_form_v2.html`     | Customer support contact form     |

**Bad versions** feature: unclear labels, hidden fields, extra steps, distracting elements.

**Good versions** feature: clear labels, pre-filled defaults, minimal fields, obvious primary action.

Run the corresponding YAML task IDs (e.g., `EXPENSE_INPUT_V1` vs `EXPENSE_INPUT_V2`) and compare token counts.

---

## Running Tests

### Python

```bash
cd python
pip install pytest
pytest
```

### Frontend

```bash
cd src
npm install
npm test
npm run build   # verify production build
```

---

## Screenshot Placeholders

```text
[ Dashboard screenshot ]          [ Task runner live log ]
```

---

## Project Structure

```text
attention-ledger/
├── docker/
│   ├── Dockerfile.api          # Python backend image
│   └── Dockerfile.web          # Next.js frontend image
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml              # Python pytest + Node jest/build
├── python/
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── tasks/                  # YAML task definitions + HTML fixtures
│   │   ├── expense_v1.html / expense_v1.yaml
│   │   ├── expense_v2.html / expense_v2.yaml
│   │   ├── shopping_cart_v1.html / shopping_cart_v1.yaml
│   │   ├── shopping_cart_v2.html / shopping_cart_v2.yaml
│   │   ├── inquiry_form_v1.html / inquiry_form_v1.yaml
│   │   └── inquiry_form_v2.html / inquiry_form_v2.yaml
│   ├── tests/                  # pytest test suite
│   └── attention_ledger/
│       ├── api/main.py         # FastAPI application
│       ├── core/               # Agent, engine, task, ledger, metrics
│       └── cli/                # CLI entrypoint
└── src/                        # Next.js frontend
    ├── app/                    # App Router pages
    ├── components/
    ├── __tests__/
    └── package.json
```

---

## License

MIT
