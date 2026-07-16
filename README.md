# Attention Ledger

**Measure the cognitive load of any UI — automatically, using AI agents.**

Attention Ledger sends a simulated first-time user (an LLM agent) to complete tasks on a web interface. The number of tokens the agent consumes while navigating and reasoning is used as a proxy for **cognitive complexity**: a confusing UI costs more tokens than a clear one. Compare two versions of the same screen and you get an objective, reproducible usability delta.

このリポジトリには、飲み会の会話バランスを整えるサブプロジェクト **[TalkBalancer](docs/talkbalancer/README.md)** も含まれています。

---

## Live Demo

TalkBalancer のPWA版は Cloudflare Pages で公開しています。

- **トップ**: <https://talkbalancer.pages.dev/talkbalancer>
- **携帯1台モード**: <https://talkbalancer.pages.dev/talkbalancer/mobile>
- **機器選定ガイド**: <https://talkbalancer.pages.dev/talkbalancer/hardware>

Cloudflare Pages は静的ホスティングのためFastAPIは動きませんが、TalkBalancerは自動的に**端末内デモモード**へ切り替わります。セッション・通知・参加者情報は同じブラウザの `localStorage` にのみ保持され、音声波形は保存・クラウド送信されません。ローカル文字起こし・自動話者切替は公開PWAでは動かず、API・WebSocketを含む下記のローカル実行またはDockerで利用できます。

従来のGitHub Pages版: <https://taguchi-1989.github.io/Atention_token/>

---

## TalkBalancer v0.4

飲み会や懇親会で、幹事が言いにくい注意を匿名の丁寧な通知で代行し、発話バランスや店内音量を見える化する進行支援アプリです。外部マイクがなくてもPC・携帯の内蔵マイク簡易モードで開始できます。モードCでは、明示同意後に短いPCM音声を自宅PCのメモリ上だけで処理し、ローカル文字起こしと現在話者の自動切替を行います。録音ファイルとクラウド送信は作りません。参加者向け画面には匿名の状態だけを出し、個人名・割合・文字起こし本文・話者対応は幹事画面に限定します。全画面の右下ランプは停止中がグレー、実際のマイク使用中だけ赤く点灯します。

[10枚組の販促・取扱説明資料を見る](public/manual/talkbalancer-v0.4/README.md)

![TalkBalancer v0.3 取扱説明書](public/manual/talkbalancer-v0.3/01-quick-start.png)

![専用マイクなしで使うローカルAI構成](public/manual/talkbalancer-v0.4/09-local-ai-architecture.png)

![話者識別と音源分離の違い](public/manual/talkbalancer-v0.4/10-speaker-identification-limits.png)

### TalkBalancerをローカルで動かす

Node.js 20以上とPython 3.11以上を用意し、リポジトリ直下で実行します。

```bash
npm ci
npm run build

# 別ターミナルで起動（Windowsは python の代わりに py でも可）
cd python
python -m pip install -r requirements.lock
# モードCのローカル文字起こし・高精度話者推定も使う場合
python -m pip install -r requirements-audio-ai.txt
python -m uvicorn attention_ledger.api.main:app --host 127.0.0.1 --port 8010
```

起動後に以下を開きます。

- <http://127.0.0.1:8010/talkbalancer>
- <http://127.0.0.1:8010/talkbalancer/mobile>
- APIドキュメント: <http://127.0.0.1:8010/docs>

`npm run build` が生成する `out/` をFastAPIが配信するため、フロントとAPIを1つのURLで確認できます。

### 動作確認状況（2026-07-16）

| 確認項目 | 結果 |
| --- | --- |
| TypeScript型チェック | 成功 |
| Jest | 29件成功 |
| Python pytest | 92件成功 |
| ESLint | エラー0（既存警告2件） |
| Next.js本番ビルド | 21ページ生成成功 |
| ローカル統合版 | `/talkbalancer`・`/mobile`・`/hardware` がHTTP 200 |
| Cloudflare Pages | 携帯1台モードがHTTP 200、PWA Service Worker配信済み |

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
git clone https://github.com/Taguchi-1989/Atention_token.git
cd Atention_token

# 2. Configure (optional — defaults work for local Ollama)
cp .env.example .env

# 3. Start everything
docker compose up --build

# 4. Open the dashboard (FastAPI serves the exported UI)
open http://localhost:8000
```

Port 8000が使用中の場合は、`APP_PORT=8010 docker compose up --build`（PowerShellでは
`$env:APP_PORT=8010; docker compose up --build`）で公開ポートを変更できます。

> The API base URL is <http://localhost:8000/api>
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
python -m venv .venv            # Windowsで複数Pythonがある場合: py -3.12 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.lock

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
# リポジトリ直下で実行（package.json はルートにあります）
npm ci
npm run dev       # http://localhost:3000
```

In development, Next.js automatically proxies `/api/*` to `http://127.0.0.1:8000`.
If the API runs on another host, set `ATTENTION_LEDGER_API_URL` in the repository root `.env.local`.

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
curl http://localhost:8000/api/tasks

# Run a task in mock mode
curl -X POST http://localhost:8000/api/tasks/EXPENSE_INPUT_V1/run \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "demo", "mock": true}'

# View run history
curl "http://localhost:8000/api/runs?limit=10&include_metrics=true"
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
python -m pytest -k "not playwright" -m "not ollama"
```

Ollamaモデルのスモークテストは、Ollamaと対象モデルを起動したうえで
`python -m pytest -m ollama` を個別に実行します。

### Frontend

```bash
npm ci
npm test -- --runInBand
npm run lint
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
├── Dockerfile                  # Next.js build + FastAPI runtime
├── docker-compose.yml          # Integrated app on port 8000
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
    └── lib/
```

---

## License

[Apache License 2.0](LICENSE)
