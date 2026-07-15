# TalkBalancer v0.3 検証結果

**実施日:** 2026-07-14

## 自動ゲート

| ゲート | 結果 |
| --- | --- |
| Pythonコア（ローカル） | 73 passed / 9 deselected |
| Python 3.12（Docker） | 73 passed / 9 deselected |
| Jest | 12 passed |
| TypeScript | `tsc --noEmit` 成功 |
| ESLint | エラー0、既存警告2 |
| Next.js production build | 静的ページ19件を生成 |
| Docker Compose | build・起動・healthcheck成功 |
| 静的画像 | intro画像2件をコンテナから `image/png` で配信 |

通常Pythonゲートは外部サービス不要とし、Playwright実サイト7件とOllamaスモーク2件を除外した。
Ollamaスモークは `python -m pytest -m ollama` で任意実行する。

## 2画面E2E

FastAPIが配信する静的UIを、テーブル画面と幹事リモコンの別タブで検証した。

1. 開始前宣言から同意確認へ進み、モードC・参加者4名でセッションを開始。
2. 幹事リモコンで田中の発話15秒をバッチ反映。
3. テーブル画面の全体・直近5分グラフへ `100% / 15秒` が反映。
4. 佐藤を話者として文字起こしメモを追加。
5. 「話しすぎ」アラートを送信し、個人名なしの丁重文言がテーブル画面へ反映。
6. 終了レポートでアラート1件、発話15秒、メモ、録音OFF・クラウドOFFを確認。
7. 画面内の二段階確認から終了・削除を実行。
8. セッションAPIが `active: false`、レポートAPIが非開催状態になり、発話・メモ・騒音状態が削除されたことを確認。

WebSocketのメトリクス往復、未開始拒否、自動騒音アラートはPythonテストで検証した。
実マイクはブラウザ権限と機器が必要なため、配布候補ごとに [TEST_PLAN.md](TEST_PLAN.md) の実機試験を行う。

## Docker実測

- Python 3.12 / Node.js 20のマルチステージビルド成功。
- `/api/health` は `{"status":"ok"}` を返却。
- `APP_PORT=8011` で公開ポート変更を確認。
- 統合テスト後、コンテナとネットワークを停止・削除。永続ボリュームは削除していない。
