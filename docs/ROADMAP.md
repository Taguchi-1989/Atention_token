# Attention Ledger Local - Roadmap v2.0

**Last Updated:** 2026-04-05  
**Current Status:** MVP 完成 → Phase 6（デプロイ・検証）へ

---

## 完了済み

### Phase 1-3: コア実装 ✅
- Python コア全モジュール (agent/execute/llm/metrics/ledger/task)
- CLI (`task run`, `baseline create`, `report diff`, `report history`)
- MockAdapter (6ステップシーケンス) + OllamaAdapter
- SQLite ストア (WAL モード、context manager)

### Phase 4: 統合 ✅
- FastAPI API 一本化 (18 エンドポイント)
- CORS / セキュリティヘッダー / 入力バリデーション
- Baseline CRUD → 実行時に model/engine/temperature/system_prompt を反映
- Next.js 全ページ API 接続 (ホーム/タスク/レジャー/SUS/設定)
- メトリクス Diff 比較 (A vs B ベースライン)
- バックグラウンドタスク実行 + ポーリング進捗表示

### Phase 5: 品質・セキュリティ ✅
- セキュリティ: path traversal防止, SSRF防止, 二重起動race修正, DoS対策
- Pydantic v2 互換、datetime 非推奨修正、コネクションリーク修正
- SUS を run_id ベースに修正（誤紐付け・偽レコード作成を廃止）
- テスト: Python 29件 + Jest 4件、Next.js ビルド成功

---

## 次: Phase 6 — デプロイ・PoC 検証

目標: **「`docker-compose up` → ブラウザで試せる」状態にする**

### 6.1 Docker 化
- [ ] `Dockerfile` (Python FastAPI)
- [ ] `Dockerfile` (Next.js)
- [ ] `docker-compose.yml` (ローカル一発起動)
- [ ] `.env.example`

### 6.2 A/B デモシナリオ作成
- [ ] 「良いUI」と「悪いUI」の HTML ペア 3 セット
  - 経費精算 (既存 expense_v1 + 改善版)
  - ショッピングカート (既存 + 改善版)
  - 問い合わせフォーム (既存 + 改善版)
- [ ] 各ペアで mock 実行 → トークン差分が出ることを確認
- [ ] PoC レポート: 「UIの複雑さ ∝ トークン消費」を定量で示す

### 6.3 CI/CD
- [ ] GitHub Actions: pytest + jest + next build
- [ ] GitHub Actions: lint (ruff + eslint)

### 6.4 ドキュメント
- [ ] README (思想 + Quick Start + スクリーンショット)
- [ ] API 仕様書 (FastAPI の /docs から OpenAPI 自動生成)
- [ ] CONTRIBUTING.md

**完了条件:** docker-compose up で動く。PoC レポートが書ける。

---

## Phase 7 — 実用機能の拡張

目標: **「自分のアプリで使える」レベルにする**

### 7.1 Playwright ベースの実 URL 対応 [HIGH]
- [ ] `PlaywrightSimulator` 追加 (SimpleWebSimulator の上位互換)
- [ ] タスク YAML に `url` フィールド対応
- [ ] スクリーンショット付き実行ログ
- [ ] DOM スナップショット → LLM に渡す

### 7.2 LLM マルチプロバイダ [HIGH]
- [ ] OpenAI API アダプター
- [ ] Claude API アダプター (Anthropic SDK)
- [ ] Settings ページでプロバイダ切替
- [ ] プロバイダ別トークン単価設定

### 7.3 レポート・エクスポート [HIGH]
- [ ] Recharts でメトリクス比較チャート (棒グラフ/折れ線)
- [ ] CSV エクスポート
- [ ] Diff サマリーの自然言語説明 (LLM生成)

### 7.4 統計的信頼性 [MEDIUM]
- [ ] 同一タスクの複数回実行 → 平均/分散/信頼区間
- [ ] A/B テスト統計検定 (p値, 効果量)
- [ ] backtrack_count / error_event_count メトリクス

### 7.5 タスクエディタ [MEDIUM]
- [ ] UI上でタスク YAML を作成/編集
- [ ] HTML アップロード → simulator に反映
- [ ] タスクのインポート/エクスポート

---

## Phase 8 — スケール・エンタープライズ

目標: **チーム利用・本番運用**

### 8.1 マルチユーザー
- [ ] ユーザー認証 (OAuth2/OIDC)
- [ ] プロジェクト管理 (複数プロジェクト)
- [ ] 権限管理・チームコラボ

### 8.2 データベース移行
- [ ] PostgreSQL 対応 + Alembic マイグレーション
- [ ] データバックアップ自動化

### 8.3 高度な可視化
- [ ] アテンションヒートマップ
- [ ] タスクフロー図自動生成
- [ ] 時系列トレンドダッシュボード

### 8.4 UI 改善
- [ ] ダークモード/ライトモード切替
- [ ] レスポンシブ (モバイル対応)
- [ ] i18n (日本語/英語)

---

## 技術スタック (確定)

| レイヤー | 技術 | 状態 |
|----------|------|------|
| フロントエンド | Next.js 14 + Tailwind CSS | ✅ |
| バックエンド | Python + FastAPI | ✅ |
| LLM (初期) | Ollama (ローカル) | ✅ |
| ストレージ | SQLite (WAL, append-only) | ✅ |
| テスト | pytest + Jest | ✅ (29 + 4) |
| API サーバー | main.py (server.py 廃止) | ✅ |
| セキュリティ | path traversal/SSRF/DoS 対策済み | ✅ |

---

**作成者**: Attention Ledger Dev Team  
**最終更新**: 2026-04-05
