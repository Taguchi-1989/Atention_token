# デモ用外部サイト一覧

Attention Ledger の Playwright 実 URL 機能で使える、ロボットアクセス OK のテスト用サイトです。
全てのサイトは自動テスト用に公開されており、自由にアクセスできます。

---

## サイト一覧

### 1. httpbin.org — ピザ注文フォーム

- **URL**: https://httpbin.org/forms/post
- **タスクID**: `DEMO_HTTPBIN_PIZZA`
- **内容**: テキスト入力、ラジオボタン、チェックボックス、送信ボタン
- **難易度**: 低（フィールドが明確）
- **特徴**: 送信結果が JSON で返るので検証が容易

### 2. SauceDemo — ECサイトログイン

- **URL**: https://www.saucedemo.com/
- **タスクID**: `DEMO_SAUCEDEMO_LOGIN`
- **内容**: ユーザー名 + パスワード入力 → ログイン
- **難易度**: 低（2フィールドのみ）
- **特徴**: テスト用 EC サイト。ログイン後に商品一覧が表示される
- **認証情報**: `standard_user` / `secret_sauce`（サイト上に記載あり）

### 3. The Internet (Heroku) — ログイン

- **URL**: https://the-internet.herokuapp.com/login
- **タスクID**: `DEMO_THE_INTERNET_LOGIN`
- **内容**: ユーザー名 + パスワード入力 → ログイン
- **難易度**: 低
- **特徴**: 自動テスト練習用サイトの定番。成功/失敗メッセージが表示される
- **認証情報**: `tomsmith` / `SuperSecretPassword!`

### 4. The Internet (Heroku) — チェックボックス

- **URL**: https://the-internet.herokuapp.com/checkboxes
- **タスクID**: `DEMO_THE_INTERNET_CHECKBOXES`
- **内容**: 2つのチェックボックスを両方 ON にする
- **難易度**: 低
- **特徴**: 最小限のインタラクション。認知負荷の下限を測るのに有用

### 5. The Internet (Heroku) — ドロップダウン

- **URL**: https://the-internet.herokuapp.com/dropdown
- **タスクID**: `DEMO_THE_INTERNET_DROPDOWN`
- **内容**: ドロップダウンから Option 2 を選択
- **難易度**: 低
- **特徴**: セレクト要素のテスト

### 6. DemoQA — 自動化練習フォーム

- **URL**: https://demoqa.com/automation-practice-form
- **タスクID**: `DEMO_DEMOQA_FORM`
- **内容**: 名前、メール、電話、住所、性別、趣味、写真アップロード、州選択、都市選択
- **難易度**: **高**（10+ フィールド、オートコンプリート、日付ピッカー、ファイルアップロード）
- **特徴**: 複雑なフォームの代表例。認知負荷が高いUIの典型
- **A/B 比較候補**: httpbin (シンプル) vs DemoQA (複雑) で認知負荷の差を測定

---

## 実行方法

### モック実行 (LLM 不要)

```bash
curl -X POST http://localhost:8000/api/tasks/demo_httpbin_pizza/run \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "BL-TEST", "mock": true}'
```

### 実 LLM 実行 (Ollama)

```bash
# 事前にベースライン作成
curl -X POST http://localhost:8000/api/baselines \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "BL-QWEN3", "model": "qwen3:4b", "engine": "ollama", "temperature": 0}'

# 実行
curl -X POST http://localhost:8000/api/tasks/demo_httpbin_pizza/run \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "BL-QWEN3", "mock": false}'
```

### バッチ実行 (同一タスク × 5回)

```bash
curl -X POST http://localhost:8000/api/tasks/demo_httpbin_pizza/batch \
  -H "Content-Type: application/json" \
  -d '{"baseline_id": "BL-QWEN3", "mock": false, "runs": 5}'
```

---

## A/B 比較のおすすめ組み合わせ

| 比較 | シンプル (低認知負荷) | 複雑 (高認知負荷) | 目的 |
|------|---------------------|-------------------|------|
| ログイン | SauceDemo (2フィールド) | — | ベースライン測定 |
| フォーム | httpbin (4フィールド) | DemoQA (10+フィールド) | フィールド数と認知負荷の相関 |
| インタラクション | Checkboxes (2クリック) | Dropdown (選択操作) | 操作種類の違い |

---

## 注意事項

- 全サイトはテスト/教育目的で公開されています
- 過度なリクエスト（秒間10回以上など）は避けてください
- サイトが落ちている場合は時間をおいて再試行してください
- W3Schools の tryit ページは iframe 内にフォームがあるため、Playwright での操作が複雑になる場合があります

---

**最終更新**: 2026-04-06
