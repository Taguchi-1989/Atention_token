# Metrics スキーマ（v0.1）

MVPで保存する実行結果の指標フォーマットです。

---

## JSON 形式（保存用）

```json
{
  "total_tokens": 1234,
  "input_tokens": 567,
  "output_tokens": 667,
  "step_count": 12,
  "retry_count": 2,
  "sus_inspired_score": 72.5,
  "sus_inspired_responses": [3,2,4,2,4,3,4,2,5,2]
}
```

---

## 実行ログ（1ステップ単位・参考）

```json
{
  "step": 3,
  "action": "click",
  "target": "submit_button",
  "confidence": "medium",
  "note": "form is filled",
  "token_usage": {
    "input_tokens": 128,
    "output_tokens": 42
  },
  "retry": false,
  "status": "ok",
  "timestamp": "2026-02-04T10:15:30Z"
}
```

---

## ルール

- Metrics は **集計済み** を保存する
- 実行ログは **追加記録**（append-only）
- レポートは **差分** を比較対象とする
