# 実装状況

**Last Updated:** 2026-07-14
**Active Milestone:** TalkBalancer v0.3 安定化

## Attention Ledger

| 領域 | 状態 | 内容 |
| --- | --- | --- |
| Pythonコア | 実装済み | task / agent / execute / llm / metrics / ledger |
| API | 実装済み | FastAPI、`/api` プレフィックス、SQLite |
| UI | 実装済み | Next.js静的書き出し、タスク・台帳・SUS・結果・設定 |
| ブラウザ評価 | 実装済み | Playwright、DOM/ビジョン入力、実URLタスク |
| Hermes | 実装済み | プライバシー保護された監査メモリ |
| 実証研究 | バックログ | [ROADMAP.md](ROADMAP.md) Phase 8 |

## TalkBalancer v0.3

| 領域 | 状態 | 内容 |
| --- | --- | --- |
| セッション・同意 | 実装済み | モードA/B/C、参加者1〜20名、保存なし固定 |
| テーブル表示 | 実装済み | 丁重アラート、騒音状態、話者比率、プライバシー表示 |
| 幹事リモコン | 実装済み | 9種のアラート、手動発話時間、モードCメモ |
| 音量解析 | 実装済み | RMS/ピーク送信、WebSocket、会話密度、騒音自動アラート |
| レポート | 実装済み | アラート・話者・メモ・プライバシー集計、終了時削除 |
| 静的デモ | 実装済み | localStorageのみ。API版と同じ主要バリデーション・削除動作 |
| 運用資料 | 実装済み | 飲み会運用ガイド、機器選定ガイド、v0.3テスト計画 |
| 自動話者分離 | 未実装 | 要件Step 5。現在は手動イベントの投入形式のみ用意 |
| 自動文字起こし | 未実装 | 現在は明示同意時の手動メモ。音声保存・クラウド送信なし |

## 正規の開発構成

- Node.js 20、ルート `package.json` / `package-lock.json` を使用する。
- Python 3.12、直接依存は `python/requirements.txt`、再現インストールは `python/requirements.lock` を使用する。
- ルート `Dockerfile` がNext.jsをビルドし、FastAPIと静的UIをポート8000で配信する。
- `docker-compose.yml` は統合アプリ1サービスで、ヘルスチェックは `/api/health` を使用する。
- 詳細なセットアップはルート [README.md](../README.md)、TalkBalancerの検証は [talkbalancer/TEST_PLAN.md](talkbalancer/TEST_PLAN.md) を参照する。

## 検証基準

| ゲート | v0.3基準 |
| --- | --- |
| Python | `pytest -q -k "not playwright" -m "not ollama"`（コア73件） |
| Frontend | `npm run test:ci` |
| TypeScript | `npm run typecheck` |
| Lint | `npm run lint` |
| Production build | `npm run build` |
| Compose syntax | `docker compose config --quiet` |
| Runtime | 2画面E2E、WebSocket往復、終了時データ削除 |

実測件数や既知の警告は、リリース時点の検証結果をREADMEまたは変更履歴へ記録する。

## 既知の注意点

- マイク入力は端末・OS・給電・ブラウザ・製品の組み合わせに依存するため、配布機器の確定前に実機試験が必要。
- `npm audit --omit=dev` はNext.js 14系に対するアドバイザリを報告する。本構成はNext.jsサーバーを実行せず、静的書き出しをFastAPIから配信するが、Next.js 15以降への更新は別マイルストーンで評価する。
- LintにはHermesの生`img`とルートレイアウトのフォント読込に関する既存警告が2件ある。TalkBalancer v0.3のビルドを妨げない。
