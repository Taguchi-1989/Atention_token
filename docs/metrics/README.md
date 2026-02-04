# 指標仕様（MVP）

この文書は、MVPで扱う指標の**妥当性（意図）・算出式・実装方針**をまとめたものです。

---

## 共通方針

- **差分評価**を前提（絶対値で評価しない）
- **同一条件**（モデル・温度・prompt・タスク）で比較
- 失敗/リトライも**記録して指標化**する

---

## Core Metrics（必須）

### 1) total_tokens

- 妥当性: 総トークンは「注意コスト」の近似値として扱う
- 算出式: `total_tokens = input_tokens + output_tokens`
- 実装方針:
  - LLMレスポンスから `input_tokens` と `output_tokens` を取得
  - 合算して保存

### 2) input_tokens

- 妥当性: 問題理解・文脈把握の負荷
- 算出式: LLMが消費した入力トークン数
- 実装方針:
  - LLMAdapter が返す TokenUsage から取得

### 3) output_tokens

- 妥当性: 意思決定・説明・探索の負荷
- 算出式: LLMが生成した出力トークン数
- 実装方針:
  - LLMAdapter が返す TokenUsage から取得

### 4) step_count

- 妥当性: 操作回数・判断回数の近似
- 算出式: `step_count = steps.length`
- 実装方針:
  - 1アクションごとに 1step を加算
  - `retry` も 1step としてカウント

### 5) retry_count

- 妥当性: 迷い・失敗の近似
- 算出式: `retry_count = count(step.action == "retry")`
- 実装方針:
  - `action=retry` を明示的に保存

---

## Optional Metrics（後続）

### SUS-inspired score（準拠・独自文言）

- 妥当性: 使いやすさの主観評価（10項目・5段階）
- 算出式: SUSスコアと同じ集計方式
- 実装方針:
  - 10項目の回答（1〜5）を受け取りスコア化
  - 設問文言は独自表現（`docs/SUS_INSPIRED_ITEMS_JP.md`）

### 6) decision_unit_level (DU-1〜DU-5)

- 妥当性: 意思決定の粒度（粗い/細かい）
- 算出式: ルールベース分類（後で定義）
- 実装方針:
  - 初期は未実装、将来の分類器に委譲

### 7) backtrack_count

- 妥当性: 試行錯誤の強さ
- 算出式: `count(step.action == "backtrack")` など
- 実装方針:
  - MVPでは `retry_count` で代用

### 8) error_event_count

- 妥当性: 明確な失敗/例外回数
- 算出式: `count(step.status == "error")`
- 実装方針:
  - 例外を捕捉して `error` ステップを記録

---

## 実装メモ

- TokenUsage は **LLMAdapter 経由で必ず取得**
- 実行ログは **append-only**
- レポートは **差分**（A/B）で出力
