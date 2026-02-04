# Attention Ledger Local Roadmap (v0.1)

This roadmap assumes:
- UI: Next.js
- Logic: Python services/modules
- Repo layout: top-level `docs/`, `src/`, and a Python workspace for core logic

---

## Phase 0: Repo bootstrap (Day 0)

- [ ] Create base directories: `docs/`, `src/`, `python/`
- [ ] Add `README.md` with vision + Quick Start (stub ok)
- [ ] Add `.gitignore` for Node + Python

---

## Phase 1: Spec lock-in (Week 1)

- [ ] Convert `スタートファイル.md` into durable docs:
  - `docs/requirements_v0.1.md`
  - `docs/agent_prompt_v1.md`
  - `docs/task_schema.md`
- [ ] Define Task YAML schema (fields + validation rules)
- [ ] Define Metrics schema (MVP + optional)
- [ ] Decide baseline ID format + immutability rules

Deliverable: frozen spec docs + examples.

---

## Phase 2: Python core (Week 1–2)

- [ ] `python/attention_ledger/` package skeleton
- [ ] Task loader (YAML → Task object)
- [ ] LLM adapter interface + mock adapter
- [ ] Execution engine (step loop, retry, logging)
- [ ] Metrics collector (token usage, steps, retries)
- [ ] Ledger store (SQLite append-only, basic schema)

Deliverable: CLI-less Python package + testable core.

---

## Phase 3: CLI (Week 2)

- [ ] `ledger baseline create`
- [ ] `ledger task run <task_id> --baseline <id>`
- [ ] `ledger report diff --task <id> --A <id> --B <id>`

Deliverable: functional CLI with local execution.

---

## Phase 4: Next.js UI (Week 3)

- [ ] UI shell + task list view
- [ ] Run history view + metrics diff
- [ ] Baseline management view
- [ ] Local API bridge to Python (HTTP or IPC)

Deliverable: local dashboard + run trigger.

---

## Phase 5: MVP validation (Week 3–4)

- [ ] UI A/B sample tasks
- [ ] Compare token diffs vs human time estimates
- [ ] Document findings + limitations

Deliverable: PoC report.

---

## Decisions needed (confirm)

- How Next.js talks to Python: `HTTP (FastAPI)` or `local CLI subprocess`?
- Python version + env tooling: `uv`, `poetry`, or `pip + venv`?
- Storage location: `./storage/ledger.db` ok?

