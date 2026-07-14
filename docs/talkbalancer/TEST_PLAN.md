# TalkBalancer v0.3 テスト計画

## 自動ゲート

リポジトリ直下で実行する。

```powershell
npm ci
npm run test:ci
npm run typecheck
npm run lint
npm run build

Set-Location python
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.lock
python -m pytest -q -k "not playwright" -m "not ollama"
```

`jest.config.js` はローカルエージェントの `.claude/`・`.omc/` 作業ツリーを除外する。
PythonはCIとDockerに合わせて3.12を基準とする。`ollama` マーカーは外部モデルが必要な任意スモークテストとして通常ゲートから除外する。

## Local PC 2画面E2E

1. `npm run build` で `out/` を生成する。
2. `cd python` から `uvicorn attention_ledger.api.main:app --port 8000` を起動する。
3. `/talkbalancer/declaration` → `/consent` でモードCと参加者を登録する。
4. テーブル端末で `/talkbalancer/table`、幹事端末で `/talkbalancer/remote` を開く。
5. 幹事端末で発話時間を追加し、テーブル端末の全体・直近5分グラフへ反映されることを確認する。
6. モードCのメモを追加し、終了レポートへ話者名と本文が表示されることを確認する。
7. 丁重アラートを送信し、テーブル端末へ個人名なしの文言が表示されることを確認する。
8. `/talkbalancer/report` で集計とプライバシー状態を確認する。
9. 「終了して削除」→「削除を確定」を実行する。
10. `/api/talkbalancer/session` が `active: false`、`/api/talkbalancer/report` が非開催状態を返すことを確認する。

## マイク・WebSocket

- 自動テスト: `tests/test_talkbalancer.py` のWebSocket往復、セッション未開始拒否、自動騒音アラート。
- 実機テスト: `/talkbalancer/mic` でブラウザのマイク許可後に外部デバイス名と入力レベルを確認する。
- テーブル画面の騒音メーターでは、音声波形ではなくRMS/ピークだけが送られることを確認する。
- マイク拒否時に再試行可能なエラー表示になることを確認する。

## Docker

```powershell
docker compose config --quiet
docker compose up --build -d
curl.exe http://localhost:8000/api/health
docker compose down
```

ポート8000が使用中の場合は `APP_PORT` を設定し、curl先も同じポートへ変更する。

期待値は `{"status":"ok"}`。統合コンテナがNext.js静的書き出しと `public/` 資産をFastAPIから配信する。
