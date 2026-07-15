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
- 外部マイクを外したPCで、内蔵マイク簡易モードへ進めること、相対音量・dBFS・ピークが数値表示されることを確認する。
- マイク確認画面で選択した内蔵／外部マイクが、テーブル表示の騒音メーターでも使用されることを確認する。
- 内蔵マイク利用時に「絶対騒音dBではない」注意が表示されることを確認する。
- テーブル画面の騒音メーターでは、音声波形ではなくRMS/ピークだけが送られることを確認する。
- マイク拒否時に再試行可能なエラー表示になることを確認する。

## Android PWA・携帯1台モード

- `/talkbalancer/mobile` から開始すると、同意後に同じ携帯1台モードへ戻ることを確認する。
- 携帯内蔵マイクで相対音量・dBFS・会話密度が更新されることを確認する。
- 幹事操作パネルを開閉し、通知送信後に同じ画面上の大表示へ反映されることを確認する。
- モードB/Cで話者時間をまとめて反映できることを確認する。
- Android ChromeのHTTPS環境でホーム画面追加、standalone起動、縦向き表示を確認する。
- `manifest.webmanifest`、192/512pxアイコン、maskableアイコン、`sw.js` が配信されることを確認する。
- Service Workerが `/api/*` をキャッシュしないことを確認する。
- 表示専用ボタンを押すと全画面化を要求し、5秒後にヘッダーと操作ボタンが隠れることを確認する。
- UI非表示中に画面をタップすると操作ボタンが戻り、「表示専用モードを終了」で通常表示へ戻れることを確認する。

## Docker

```powershell
docker compose config --quiet
docker compose up --build -d
curl.exe http://localhost:8000/api/health
docker compose down
```

ポート8000が使用中の場合は `APP_PORT` を設定し、curl先も同じポートへ変更する。

期待値は `{"status":"ok"}`。統合コンテナがNext.js静的書き出しと `public/` 資産をFastAPIから配信する。
