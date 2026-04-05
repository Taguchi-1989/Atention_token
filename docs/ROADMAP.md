# Attention Ledger Local - Roadmap v1.0

**Last Updated:** 2026-04-05  
**Current Status:** MVP コア完成、統合・仕上げフェーズ

---

## 実装状況サマリー

| レイヤー | 状態 | 備考 |
|----------|------|------|
| Python コア (agent/execute/llm/metrics/ledger) | **完了** | 12テスト全パス |
| CLI (`task run`, `report history`) | **完了** | mock/real 切替可 |
| CLI (`baseline create`, `report diff`) | **未実装** | スタブのみ |
| FastAPI サーバー (`/tasks`, `/runs`, `/sus`) | **完了** | main.py が正 |
| FastAPI Config API | **未実装** | 旧server.pyにのみ存在 |
| Next.js UI (tasks/ledger/sus/settings) | **完了** | API連携済み |
| ダッシュボード統計 | **モック** | DB未接続 |
| テスト (unit) | **完了** | simulator + SUS |
| テスト (API/E2E) | **未実装** | |
| Docker / デプロイ | **未実装** | |

---

## Phase 4: 統合仕上げ (現在)

目標: **UIとAPIが完全に繋がり、一通りの操作が実際に動く状態**

### 4.1 API 統合の穴埋め

- [ ] **server.py 整理**: 旧 server.py を廃止し main.py に一本化
- [ ] **Config エンドポイント移植**: `GET/PUT /config` を main.py に追加
  - Ollama URL, model, temperature の読み書き
- [ ] **Baseline CRUD 実装**: `POST /baselines`, `GET /baselines`, `DELETE /baselines/{id}`
- [ ] **Report Diff API**: `GET /metrics/diff?task_id=X&baseline_a=Y&baseline_b=Z`
- [ ] **CORS設定**: Next.js dev server からのアクセス許可

### 4.2 CLI 未実装コマンド

- [ ] `baseline create` - 実際にDBへベースライン保存
- [ ] `report diff` - 2つのベースライン間のメトリクス差分表示

### 4.3 ダッシュボード実データ接続

- [ ] ホームページ統計をDB集計値に差し替え (Active Tasks, Total Executions, etc.)
- [ ] Recent Activities を実行履歴から動的取得

### 4.4 非同期タスク実行

- [ ] `POST /tasks/{task_id}/run` をバックグラウンド実行に変更
- [ ] SSE エンドポイント: `GET /tasks/exec/{id}/stream` で進捗配信
- [ ] Next.js 側でリアルタイム進捗表示

**完了条件:** UIからタスク実行→結果確認→比較、がすべて実データで動く

---

## Phase 5: テスト・品質強化

目標: **MVP としてリリースできる品質**

### 5.1 テスト追加

- [ ] **API テスト**: FastAPI TestClient で全エンドポイント
- [ ] **Agent 統合テスト**: MockAdapter でタスク実行→レジャー記録の一連フロー
- [ ] **Next.js コンポーネントテスト**: 主要ページの描画・操作テスト
- [ ] **E2E テスト**: Playwright で UI→API→DB のフルフロー

### 5.2 エラーハンドリング強化

- [ ] API レスポンスの統一エラー形式
- [ ] Ollama 接続失敗時の graceful fallback
- [ ] UI でのエラー通知改善

### 5.3 サンプルタスク拡充

- [ ] 3種のA/Bペアタスク作成 (良いUI vs 悪いUI)
- [ ] 対応するHTML UIサンプル
- [ ] 「トークン差分が実際に出る」デモデータ

**完了条件:** テストカバレッジ80%以上、デモシナリオが動作

---

## Phase 6: MVP 検証・デプロイ

目標: **誰でもワンコマンドで起動・試用できる**

### 6.1 Docker 化

- [ ] `Dockerfile` (Python FastAPI)
- [ ] `Dockerfile` (Next.js)
- [ ] `docker-compose.yml` (ローカル一発起動)
- [ ] `.env.example`

### 6.2 PoC 検証

- [ ] サンプルタスクでA/B実行 → トークン差分を確認
- [ ] 人の実測時間との方向一致を検証
- [ ] PoC レポート作成

### 6.3 CI/CD

- [ ] GitHub Actions: テスト自動実行
- [ ] GitHub Actions: lint + type check

### 6.4 ドキュメント

- [ ] README (Quick Start 含む)
- [ ] API仕様書 (OpenAPI 自動生成)
- [ ] セットアップガイド

**完了条件:** `docker-compose up` で動く、PoC レポートが書ける

---

## Phase 7: 機能拡張

目標: **実用性と対応範囲の拡大**

### 7.1 LLM マルチプロバイダ対応 [HIGH]

- [ ] OpenAI API アダプター
- [ ] Claude API アダプター
- [ ] モデル切替UI (Settings ページ)
- [ ] プロバイダ別トークン単価設定

### 7.2 レポート・エクスポート [HIGH]

- [ ] PDF レポート自動生成
- [ ] CSV/Excel エクスポート
- [ ] メトリクス比較チャート (Recharts)
- [ ] Diff サマリーの自然言語説明 (LLM生成)

### 7.3 高度なメトリクス [MEDIUM]

- [ ] Decision Unit Level (DU-1〜DU-5) 分類
- [ ] backtrack_count / error_event_count
- [ ] 信頼区間計算 (複数回実行の統計)
- [ ] A/B テスト統計検定 (p値)

### 7.4 タスクシナリオ拡張 [MEDIUM]

- [ ] マルチステップシナリオ (条件分岐)
- [ ] 外部URL対応 (Playwright ベース)
- [ ] スクリーンショット付きログ

### 7.5 UI 改善 [LOW]

- [ ] ダークモード/ライトモード切替
- [ ] レスポンシブデザイン (モバイル対応)
- [ ] アクセシビリティ改善 (WCAG 2.1 AA)
- [ ] i18n (日本語/英語)

---

## Phase 8: スケール・エンタープライズ

目標: **チームで使える、本番運用可能**

### 8.1 マルチユーザー

- [ ] ユーザー認証 (OAuth2/OIDC)
- [ ] プロジェクト管理 (複数プロジェクト)
- [ ] チームコラボレーション
- [ ] 権限管理

### 8.2 データベース移行

- [ ] PostgreSQL 対応
- [ ] マイグレーション基盤 (Alembic)
- [ ] データバックアップ自動化

### 8.3 可視化・分析

- [ ] アテンションヒートマップ
- [ ] タスクフロー図自動生成
- [ ] ML ベース異常検知
- [ ] 時系列トレンド分析ダッシュボード

---

## 決定事項

| Item | 決定 | 状態 |
|------|------|------|
| UI フレームワーク | Next.js 14 + Tailwind CSS | 実装済み |
| バックエンド | Python + FastAPI | 実装済み |
| LLM 初期版 | Ollama (local) | 実装済み |
| Storage | SQLite (append-only) | 実装済み |
| テスト | pytest + Jest | 実装済み |
| API正本 | main.py (server.py は廃止予定) | 決定 |

## リスク & 対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Ollama 接続不安定 | HIGH | MockAdapter fallback + Phase 7 でマルチプロバイダ |
| API 二重実装の混乱 | MEDIUM | Phase 4.1 で server.py 廃止 |
| トークン差分の再現性 | MEDIUM | temperature=0 固定 + 複数回実行の統計処理 |
| SQLite スケーリング | LOW | Phase 8 で PostgreSQL 移行 |

---

**作成者**: Attention Ledger Dev Team  
**最終更新**: 2026-04-05
