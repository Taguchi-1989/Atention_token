# Python Core

## Setup (pip + venv)

```bash
python -m venv .venv             # Windowsで複数Pythonがある場合: py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.lock
# TalkBalancerモードC（任意・モデルはローカルPCにダウンロード）
pip install -r requirements-audio-ai.txt
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

TalkBalancerモードCは `faster-whisper` と `pyannote.audio` を遅延ロードする。音声は16kHz PCMとしてWebSocketで受け、ファイル保存せず最大12秒のメモリバッファで処理する。追加依存がない場合も、音量計測と簡易音響クラスタによる匿名話者切替は利用できる。

### Environment

- `ATTENTION_LEDGER_TASKS_DIR` (default: `python/tasks`)
- `ATTENTION_LEDGER_DB_PATH` (default: `python/ledger.db`)
- `TB_WHISPER_MODEL` (default: `small`)
- `TB_WHISPER_DEVICE` (`cpu` / `cuda`, default: `cpu`)
- `TB_WHISPER_COMPUTE_TYPE` (CPU default: `int8`)
- `TB_SPEAKER_ENGINE` (`auto` / `pyannote` / `acoustic`, default: `auto`)
- `TB_SPEAKER_DISTANCE` (pyannote online clustering default: `0.65`)
- `PYANNOTE_METRICS_ENABLED=0`（実装内でも既定OFF）
