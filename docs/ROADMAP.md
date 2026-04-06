# Attention Ledger Local - Roadmap v3.0

**Last Updated:** 2026-04-06  
**Current Status:** 初回実験完了 → Phase 8（実証研究の深化）へ

---

## 完了済み

### Phase 1-3: コア実装 ✅

- Python コア全モジュール (agent/execute/llm/metrics/ledger/task)
- CLI (`task run`, `baseline create`, `report diff`, `report history`)
- MockAdapter (6ステップシーケンス) + OllamaAdapter
- SQLite ストア (WAL モード、context manager)

### Phase 4: 統合 ✅

- FastAPI API 一本化 (/api/ プレフィックス、20+ エンドポイント)
- セキュリティ: path traversal, SSRF, DoS 対策、入力バリデーション
- Baseline CRUD → 実行時に model/engine/temperature/system_prompt を反映
- Next.js 全ページ日本語 UI + API 接続

### Phase 5: 品質・セキュリティ ✅

- Pydantic v2 互換、SQLite context manager、コネクションリーク修正
- SUS を run_id ベースに修正
- テスト: Python 34件 + Jest 9件

### Phase 6: デプロイ・PoC ✅

- 統合 Dockerfile (マルチステージ: Node build → Python serve)
- docker-compose.yml (1サービス構成)
- A/B デモ HTML 3ペア (expense, shopping_cart, inquiry_form)
- ワンクリックデモボタン + HTMLプレビュー機能
- GitHub Actions CI
- README

### Phase 7: 機能拡張 ✅

- 7.1 Playwright 実 URL 対応 (PlaywrightSimulator + タスク URL フィールド)
- 7.3 Recharts チャート (棒グラフ/折れ線) + CSV エクスポート
- 7.4 バッチ実行 API (同一タスク × N回 + 統計)
- Vision 対応 (Ollama vision API + スクリーンショット入力)
- 認知負荷スコア (output_tokens + steps×100 + retries×500)
- LLM パーサー強化 (`<think>` タグ除去、JSON 抽出堅牢化)

### 初回実験結果 ✅

- テキストモデル (qwen3:4b) vs ビジョンモデル (qwen3-vl:4b) での A/B 比較
- ビジョンモデルで仮説通りの方向を確認 (良いUI = 低スコア)
- テキストモデルでの逆転現象を特定・分析
- 詳細: [EXPERIMENT_RESULTS.md](EXPERIMENT_RESULTS.md)

---

## 次: Phase 8 — 実証研究の深化

目標: **「このツールで UI の良し悪しを定量的に判断できる」ことを統計的に証明する**

### 8.1 8B ビジョンモデルでのマルチステップ完遂テスト [HIGH]

- [ ] qwen3-vl:8b を pull して同一タスクで実行
- [ ] 4B で不安定だったマルチステップ完遂を確認
- [ ] 4B vs 8B のスコア比較 → モデルサイズと精度の関係

### 8.2 HTML ペアの情報量均等化 [HIGH]

- [ ] expense v1/v2 の DOM テキスト量を揃えた HTML ペアを作成
- [ ] テキストモデルでの逆転が解消されるか検証
- [ ] 「構造の違いだけ」で差が出ることを確認

### 8.3 統計的有意性の検証 [HIGH]

- [ ] 各条件 × 10回の実行
- [ ] 平均/標準偏差/信頼区間の算出
- [ ] p値 (ウェルチの t 検定) で v1 vs v2 の差が有意かを検定
- [ ] バッチ実行 API の stats に標準偏差/信頼区間を追加

### 8.4 SUS との相関分析 [HIGH]

- [ ] 同じ 3ペアの HTML を人間にも SUS 評価させる
- [ ] LLM 認知負荷スコアと SUS スコアの相関係数を算出
- [ ] 複合スコアの重み (α, β) を回帰で最適化:
  - `認知負荷 = α × ビジョンスコア + β × テキストスコア(リトライ重み付き)`

### 8.5 実アプリケーションでの検証 [MEDIUM]

- [ ] 社内システムの代表画面 3-5 枚でスクリーンショットベース評価
- [ ] 同じ画面の改善前/改善後を比較
- [ ] 「この指標でリニューアルの効果を定量化できるか」の実証

### 8.6 ビジョンのみ vs DOM付与の差分指標 [MEDIUM]

- [ ] 同じ画面に対して「スクショのみ」と「スクショ+DOM」で実行
- [ ] 差が大きい = 「見た目だけでは操作がわかりにくい UI」
- [ ] この差分自体を UI 評価指標として提案

---

## Phase 9 — スケール・公開

目標: **OSS として公開し、他者が使える状態にする**

### 9.1 LLM マルチプロバイダ

- [ ] OpenAI API アダプター
- [ ] Claude API アダプター (Anthropic SDK)
- [ ] Settings ページでプロバイダ切替

### 9.2 マルチユーザー

- [ ] ユーザー認証 (OAuth2/OIDC)
- [ ] プロジェクト管理
- [ ] チームコラボレーション

### 9.3 高度な可視化

- [ ] アテンションヒートマップ
- [ ] タスクフロー図自動生成
- [ ] 時系列トレンドダッシュボード

### 9.4 論文・発表

- [ ] 実験結果を技術ブログまたは論文形式でまとめる
- [ ] OSS README に実験結果のサマリーを掲載
- [ ] デモ動画作成

---

## 技術スタック

| レイヤー | 技術 | 状態 |
|----------|------|------|
| フロントエンド | Next.js 14 + Tailwind + Recharts | ✅ |
| バックエンド | Python + FastAPI | ✅ |
| LLM テキスト | Ollama (qwen3:4b, gemma3:4b) | ✅ |
| LLM ビジョン | Ollama (qwen3-vl:4b) | ✅ |
| ブラウザ操作 | Playwright (実URL対応) | ✅ |
| ストレージ | SQLite (WAL, append-only) | ✅ |
| テスト | pytest 34件 + Jest 9件 | ✅ |
| デプロイ | Docker (マルチステージ統合) | ✅ |
| CI | GitHub Actions | ✅ |

---

## 重要な知見 (実験から)

1. **ビジョンモデルのスコアは仮説通り** — 良いUI (v2) は悪いUI (v1) の 1/10 のスコア
2. **テキストモデルでは DOM 情報量で逆転する** — 単独では認知負荷の代理指標にならない
3. **リトライ数が最も安定した指標** — 条件によらず良いUIで一貫して少ない
4. **テキスト + ビジョンの複合評価が最適** — それぞれ異なる認知負荷の側面を捉える
5. **4B ビジョンモデルはシングルステップOK、マルチステップは8B以上が必要**

---

**作成者**: Attention Ledger Dev Team  
**最終更新**: 2026-04-06
