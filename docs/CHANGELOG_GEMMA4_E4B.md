# Gemma4:E4B 対応ログ

**コミット:** 12cef1e  
**日付:** 2026年4月  
**対象:** Attention Ledger プロジェクトに Gemma4:E4B (Google の最新 Effective 4B MoE モデル) のサポートを追加

---

## 概要

このログは、Attention Ledger プロジェクトで Google の Gemma4:E4B モデルへの対応実装に関するすべての技術的変更をまとめたものです。本対応により、expense_v1、inquiry_form_v1 などのタスクが失敗状態から成功状態に改善しました。

---

## 変更内容

### 1. デフォルトモデルの変更

**ファイル:** `python/attention_ledger/core/llm/config.py`

- `model_name` を `"llama3"` から `"gemma4:e4b"` に変更
- Gemma4:E4B は Google による最新の Effective 4B MoE モデル (2026年4月)

**影響:**
- すべての LLM 推論がデフォルトで新しいモデルを使用

---

### 2. OllamaAdapter のタイムアウト延長

**ファイル:** `python/attention_ledger/core/llm/adapter.py`

- タイムアウト時間: 60秒 → 120秒
- **理由:** Gemma4:E4B は読み込み後の最初の推論が遅くなる傾向があります (モデルサイズ 9.6GB)

**影響:**
- 大規模モデルの初期実行時にタイムアウトエラーが起きなくなります

---

### 3. シミュレータでの SELECT 要素サポート

**ファイル:** `python/attention_ledger/core/execute/simulator.py`

#### 3.1 DOM レンダリング拡張

`_render_dom()` メソッドに SELECT 要素のレンダリング機能を追加:
```
[SELECT id=... options=[...]]
```

#### 3.2 アクション処理の追加

`execute_action()` メソッドに `select` アクションハンドラを追加

**背景:**
- 以前は、ドロップダウン/セレクト要素が LLM に見えず、操作できませんでした
- SELECT 要素の追加により、Web フォームのセレクトボックスを適切に処理できるようになりました

---

### 4. ID プレフィックスの正規化

**ファイル:** `python/attention_ledger/core/execute/simulator.py`

#### 4.1 新規メソッド追加

`_normalize_target()` メソッドを追加

#### 4.2 処理内容

- LLM が `id=route` を返した場合、`id=` プレフィックスを削除して `route` に正規化
- **背景:** LLM は画面出力の形式 `[INPUT id=route ...]` をコピーする傾向があるため

**影響:**
- LLM の返却値の形式ゆれを吸収し、エラーを減らします

---

### 5. サブミット画面遷移

**ファイル:** `python/attention_ledger/core/execute/simulator.py`

#### 5.1 状態管理

`submitted` 状態フラグを追加

#### 5.2 動作

サブミットボタンがクリックされた場合、`get_visible_text()` が以下を返す:
```
SUCCESS: Your submission has been completed.
```

**背景:**
- 以前は、サブミットボタンをクリックしても画面が変わらず、エージェントが無限ループに陥っていました
- この改善により、成功状態を明確に判定できるようになりました

**影響:**
- フォーム送信後のエージェント行動が正確になり、ループが解消されます

---

### 6. エンジンへの select アクション追加

**ファイル:** `python/attention_ledger/core/execute/engine.py`

- SimpleWebSimulator の許可アクションリストに `'select'` を追加

**影響:**
- エンジンレベルで select アクションが実行可能になります

---

### 7. プロンプト改善

**ファイル:** `python/attention_ledger/core/agent/prompts.py`

#### 7.1 利用可能なアクションの追加

`select` を利用可能なアクションに追加

#### 7.2 制約条件の強化

新たに以下の制約を追加:
- "target MUST be the exact element id" (ターゲットは正確な要素 ID でなければならない)
- 「generic names like 'input' or 'button_name' を使用しないこと」
- 「'id=' のようなプレフィックスを追加しないこと」

#### 7.3 ターゲット説明の詳細化

ターゲット説明を以下のように更新:
- **以前:** 汎用的な "button_name | field_name"
- **現在:** "exact_element_id (e.g. route, submit_btn)"

**影響:**
- LLM がより正確な要素 ID を返すようになり、エラーが減少します

---

### 8. スモークテスト追加

**ファイル:** `python/tests/test_gemma4_smoke.py` (新規作成)

#### 8.1 JSON 生成テスト

```python
test_gemma4_e4b_generate()
```
- 基本的な JSON 生成機能をテストします

#### 8.2 エージェントアクション解析テスト

```python
test_gemma4_e4b_agent_action()
```
- ログインページシナリオでのエージェントアクション解析をテストします

**影響:**
- Gemma4:E4B の基本的な機能が検証されます

---

## 実装効果

### タスク成功率の改善

| タスク | 結果 | ステップ数 | リトライ | トークン数 |
|--------|------|----------|---------|----------|
| expense_v1 | 失敗 → 成功 | 5 | 0 | 3,817 |
| inquiry_form_v1 | 失敗 → 成功 | 11 | 1 | 18,523 |

### 互換性

- **すべての変更は後方互換性を維持します**
- 既存のタスク/ベースラインは影響を受けません

---

## 技術的な考察

### Gemma4:E4B の特性

- **モデル:** Google Effective 4B MoE (Mixture of Experts)
- **モデルサイズ:** 9.6GB
- **特徴:** 初回推論は時間がかかる傾向

### 改善のポイント

1. **UI 要素の完全性:** SELECT 要素をサポートすることで、複雑なフォームをシミュレートできるようになりました
2. **LLM 出力の堅牢化:** プレフィックス正規化と ID 制約により、エラーが減少
3. **フロー制御の明確化:** サブミット状態フラグにより、エージェントループが解消
4. **プロンプト最適化:** より詳細で厳密な指示により、LLM の出力精度向上

---

## 更新時の確認事項

本対応を適用する際は、以下を確認してください:

- [x] Ollama で Gemma4:E4B モデルが利用可能であること
- [x] `test_gemma4_smoke.py` が正常に実行されること
- [x] expense_v1, inquiry_form_v1 のタスクが成功状態であること
- [x] 既存のタスク/ベースラインが失敗していないこと

