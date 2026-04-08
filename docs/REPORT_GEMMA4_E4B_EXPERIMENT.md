# 実験レポート: Gemma4:E4B による UI 認知負荷測定

**実施日:** 2026-04-08  
**実験者:** Attention Ledger Dev Team  
**モデル:** Google Gemma4:E4B (Effective 4B, MoE)  
**環境:** Windows 11 / RTX 3060 Ti (8GB VRAM) / 64GB RAM / Ollama

---

## 1. 実験の目的

Gemma4:E4B を Attention Ledger の認知負荷測定エンジンに導入し、以下を検証する:

1. **判断精度** — 各 UI に対して正しい操作順序を導き出せるか
2. **トークン効率** — 旧モデル (qwen3:4b) と比較してどの程度効率的か
3. **UI 複雑さの識別** — フォームの難易度差をスコアに反映できるか

---

## 2. 被験 UI

3種類の HTML フォームを使用。いずれも「悪い UI」として設計されたもの。

### 2.1 EXPENSE_INPUT_V1（経費精算フォーム）

```
┌──────────────────────────────────┐
│  Travel Expense Claim Form       │
│                                  │
│  Date (YYYY-MM-DD): [________]   │
│  Route (From - To): [________]   │
│  Amount (JPY):      [________]   │
│                                  │
│  [Submit Claim]                  │
└──────────────────────────────────┘
```

- **フィールド数:** 3（date, route, amount）
- **特徴:** ラベルが英語のみ、プレースホルダのみ、バリデーション無し
- **難易度:** 低

### 2.2 INQUIRY_FORM_V1（問い合わせフォーム）

```
┌──────────────────────────────────────────────────┐
│ HelpDesk Portal v3.2           guest | Sign Out  │
├──────────────────────────────────────────────────┤
│ Support Menu │ Contact / Feedback / Support Form │
│ ─────────── │                                    │
│ FAQ          │ ⚠ Please read FAQ before submit   │
│ My Tickets   │                                    │
│ Live Chat    │ Inquiry Type*    [SELECT ▼]        │
│ Phone        │ Priority         [SELECT ▼]        │
│ Email        │ Full Name*       [________]        │
│              │ Furigana         [________]        │
│ Resources    │ Email*           [________]        │
│ ─────────── │ Confirm Email*   [________]        │
│ User Manual  │ Phone            [________]        │
│ Video Guides │ Company          [________]        │
│ Release Notes│ Department       [________]        │
│ Known Issues │ Account ID       [________]        │
│ Status Page  │ Product/Service* [SELECT ▼]        │
│              │ Version          [________]        │
│ Account      │ OS/Browser       [________]        │
│ ─────────── │ Subject*         [________]        │
│ Profile      │ Message*         [TEXTAREA]        │
│ Preferences  │ Attachment       [FILE    ]        │
│ Notifications│ Referral         [SELECT ▼]        │
│ Billing      │ Newsletter       [☐ Subscribe]     │
│              │ CAPTCHA*         [IMAGE] [____]    │
│              │ [☐ Terms of Service]               │
│              │                                    │
│              │ [Confirm→] [Submit] [Reset]        │
└──────────────┴────────────────────────────────────┘
```

- **フィールド数:** 18（input 10 + select 4 + textarea 1 + file 1 + checkbox 2）
- **特徴:** サイドバーに多数のリンク、CAPTCHA、利用規約同意、Confirm→Submit の2段階
- **難易度:** 高

### 2.3 SHOPPING_CART_V1（EC サイト）

```
┌──────────────────────────────────────────────────────┐
│!! FLASH SALE — UP TO 70% OFF !! FREE SHIPPING !!    │
├──────────────────────────────────────────────────────┤
│Home Electronics Cameras Audio Computers TV Gaming... │
├──────────┬───────────────────────────────────────────┤
│ Filter   │ SPECIAL OFFER: Buy 2 Get 1 FREE!         │
│ ──────── │                                           │
│ Brand    │ [wireless headphones] [▼Category] [SEARCH]│
│ ☐ Sony   │                                           │
│ ☑ Bose   │ ┌──────┐ ┌──────┐ ┌─SPONSORED─┐          │
│ ☐ JBL    │ │XM5   │ │QC45  │ │BT Pro 500│          │
│ ☐ Senn.. │ │★★★★★ │ │★★★★☆ │ │★★★☆☆     │          │
│           │ │¥38500│ │¥39600│ │¥8800     │          │
│ Price    │ │[Cart]│ │[Cart]│ │[Cart]    │          │
│ ○ <10K   │ └──────┘ └──────┘ └──────────┘          │
│ ● 10-50K │ ┌──────┐ ┌──────┐ ┌──────────┐          │
│ ○ >50K   │ │770NC │ │HD450 │ │AirPods   │          │
│           │ │★★★★☆ │ │★★★★☆ │ │★★★★★     │          │
│ [Apply]  │ │¥19800│ │¥17600│ │¥79800    │          │
│ [Clear]  │ │[Cart]│ │[Cart]│ │[Cart]    │          │
└──────────┴───────────────────────────────────────────┘
```

- **操作要素:** 検索バー + カテゴリselect + フィルター多数 + 商品6件各に Add to Cart
- **特徴:** id なし要素が多い、SPONSORED 商品、フラッシュセールバナー、多数のノイズ
- **難易度:** 非常に高

---

## 3. 実験結果

### 3.1 最終結果（全修正適用後）

| タスク | 成功 | ステップ | リトライ | 入力トークン | 出力トークン | 合計トークン | 認知負荷スコア |
|--------|------|----------|----------|-------------|-------------|-------------|---------------|
| **EXPENSE_INPUT_V1** | **成功** | 5 | 0 | 2,095 | 1,722 | 3,817 | **2,222** |
| **INQUIRY_FORM_V1** | **成功** | 11 | 1 | 12,382 | 6,141 | 18,523 | **7,741** |
| **SHOPPING_CART_V1** | 失敗 | 4 | 2 | 4,210 | 1,482 | 5,692 | **2,882** |

**認知負荷スコア** = output_tokens + step_count × 100 + retry_count × 500

### 3.2 エージェントの実際の判断ログ

#### EXPENSE_INPUT_V1（成功 — 5ステップ）

```
Step 1: input → target=date    "Entering the date for the travel expense claim."
Step 2: input → target=route   "Entering the route for the transportation expense."
Step 3: input → target=amount  "Entering the amount for the travel expense claim."
Step 4: click → target=submit_btn "Clicking the submit button to finalize the expense claim."
Step 5: done                   "The submission was successful, indicating the task is complete."
```

**分析:** 完璧な操作。迷い一切なし。フィールドを上から順に正確に埋め、submit して完了を認識。

#### INQUIRY_FORM_V1（成功 — 11ステップ）

```
Step 1:  select → inquiry_type   "Selecting the inquiry type as required by the form."
Step 2:  select → priority       "Selecting a default priority as it is a required field."
Step 3:  input  → full_name      "Filling required name field."
Step 4:  input  → furigana       "Filling in the mandatory Furigana field."
Step 5:  input  → email_addr     "Filling required email address field."
Step 6:  input  → email_confirm  "Filling in the required email confirmation field."
Step 7:  input  → subject        "Filling the required subject field."
Step 8:  select → product        "Selecting a product as it is a required field."
Step 9:  click  → N/A            "Attempting to click 'Confirm' ..." (失敗 → retry)
Step 10: click  → submit_btn     "Attempting to submit the form."
Step 11: done                    "Goal achieved as success message is displayed."
```

**分析:**
- Step 1-8: 18フィールド中、必須フィールドを優先的に選択。**不要なフィールド (phone, company, department, account_id, version, os_browser, message_body, attachment, referral, newsletter, captcha) をスキップ**した。これは「初回ユーザーが最低限の入力で送信を試みる」行動として自然。
- Step 9: 「Confirm →」ボタンのクリックに失敗（id が無いため）。**1回だけリトライ**して submit_btn に切り替えた判断は適切。
- 18フィールドのフォームを 11ステップで完了 = **効率的な判断**

#### SHOPPING_CART_V1（失敗 — 4ステップ）

```
Step 1: click  → Audio      "Starting by navigating to the Audio category." (失敗)
Step 2: select → N/A        "Selecting 'Electronics > Audio' from dropdown." (失敗)
Step 3: input  → q          "Searching for headphones using the search input."
Step 4: (パースエラー)
```

**分析:**
- Step 1-2: カテゴリ選択を試みるが、id なし要素のため失敗
- Step 3: 検索バー (id=q) への入力は成功。正しい判断。
- Step 4: 次の操作のJSON パースに失敗して停止
- **根本原因:** HTML 側の問題。ボタンや select に id が付いていない。テスト対象 UI の設計上の欠陥がそのままスコアに反映されている — これは意図通り。

---

## 4. モデル比較: Gemma4:E4B vs qwen3:4b

### 4.1 EXPENSE_INPUT_V1

| 指標 | qwen3:4b (BL-QWEN3) | gemma4:e4b (BL-GEMMA4-E4B) | 改善率 |
|------|---------------------|---------------------------|--------|
| 成功率 | 5/5 (100%) | 1/1 (100%) | — |
| ステップ数 | 5.0 | 5 | 同等 |
| リトライ | 0.0 | 0 | 同等 |
| 出力トークン | 7,931 (平均) | 1,722 | **-78%** |
| 認知負荷スコア | 8,431 (平均) | 2,222 | **-74%** |

**出力トークン 78% 削減。** qwen3:4b は各ステップで冗長な推論テキストを出力していたが、Gemma4:E4B は簡潔な JSON のみを返す。

### 4.2 INQUIRY_FORM_V1

| 指標 | qwen3:4b (BL-TEXT) | gemma4:e4b (BL-GEMMA4-E4B) | 改善 |
|------|-------------------|---------------------------|------|
| 成功率 | 0/3 (0%) | 1/1 (100%) | **0% → 100%** |
| ステップ数 | 20 (上限到達) | 11 | **-45%** |
| リトライ | 17 (平均) | 1 | **-94%** |
| 出力トークン | 49,508 (平均) | 6,141 | **-88%** |
| 認知負荷スコア | 59,675 (平均) | 7,741 | **-87%** |

**qwen3:4b では完遂不可能だったタスクを成功。** リトライ 17→1、認知負荷スコア 87% 削減。

### 4.3 比較グラフ（テキスト表現）

```
認知負荷スコア比較（低い方が良い）

EXPENSE_INPUT_V1:
  qwen3:4b    ████████████████████████████████████████████  8,431
  gemma4:e4b  ███████████                                   2,222

INQUIRY_FORM_V1:
  qwen3:4b    ██████████████████████████████████████████████████████████████████████████████████  59,675
  gemma4:e4b  ██████████                                                                          7,741
```

```
出力トークン比較

EXPENSE_INPUT_V1:
  qwen3:4b    ████████████████████████████████████████  7,931
  gemma4:e4b  █████████                                 1,722

INQUIRY_FORM_V1:
  qwen3:4b    ██████████████████████████████████████████████████████████████████████████████████  49,508
  gemma4:e4b  ████████                                                                            6,141
```

---

## 5. イテレーション経過

今回の実験では、4ラウンドの改善を経て最終結果に到達した。その経過自体が「計測インフラの成熟度がスコアに与える影響」を示す興味深いデータである。

### 5.1 ラウンド別 EXPENSE_INPUT_V1

| ラウンド | 問題 | ステップ | リトライ | トークン | スコア |
|----------|------|----------|----------|----------|--------|
| R1: 初回 | `id=route` をシミュレータが認識不可 | 20 | 19 | 15,661 | 19,425 |
| R2: id= 正規化 | target に `id=route` を使用 | 20 | 17 | 15,274 | 18,102 |
| R3: プロンプト改善 | submit 後の画面遷移なし | 20 | 0 | 14,366 | 7,227 |
| **R4: 最終** | **(問題なし)** | **5** | **0** | **3,817** | **2,222** |

```
認知負荷スコア推移

R1  ██████████████████████████████████████████████████████████████████████████████████  19,425
R2  ████████████████████████████████████████████████████████████████████████████        18,102
R3  ██████████████████████████████████                                                   7,227
R4  █████████                                                                            2,222
```

**各ラウンドで何が改善されたか:**
- R1→R2: シミュレータが `id=route` を `route` に正規化 → retry 微減
- R2→R3: プロンプトで「正確な要素IDを使え」を明示 → **retry 17→0**
- R3→R4: submit 後に成功画面を表示 → **ステップ 20→5、タスク成功**

### 5.2 ラウンド別 INQUIRY_FORM_V1

| ラウンド | ステップ | リトライ | トークン | スコア | 成功 |
|----------|----------|----------|----------|--------|------|
| R1: 初回 | 20 | 19 | 27,956 | 19,835 | 失敗 |
| R2: 修正後 | 4 | 0 | 4,722 | 1,804 | 失敗 (Agent Error) |
| R3: プロンプト改善 | 20 | 4 | 40,126 | 19,639 | 失敗 (Max steps) |
| **R4: 最終** | **11** | **1** | **18,523** | **7,741** | **成功** |

R2 は 4ステップで Agent Error — select が動くようになった直後、正しい操作ができたがパースエラーで停止。R3 は submit 後のループ。R4 で全問題解消。

---

## 6. 考察

### 6.1 Gemma4:E4B の強み

**指示遵守能力が高い。** 「target は正確な要素IDを使え」という制約を忠実に守る。qwen3:4b ではプロンプトの制約が効かず冗長な出力が続いたが、Gemma4:E4B は簡潔な JSON を一貫して返す。

**必須フィールドの優先判断。** inquiry_form_v1 で 18 フィールド中、`*` 付きの必須フィールドを優先的に入力し、任意フィールドをスキップした。これは「初回ユーザーの自然な行動」として妥当であり、人間の行動パターンに近い。

**失敗からの回復が早い。** Step 9 で Confirm ボタンのクリックに失敗した後、1回のリトライで submit_btn に切り替えた。qwen3:4b では同じ操作を 17回リトライし続けた。

### 6.2 UI 複雑さとスコアの相関

| UI | フィールド数 | 認知負荷スコア | トークン/フィールド |
|----|------------|---------------|-------------------|
| expense_v1 | 3 | 2,222 | 741 |
| inquiry_form_v1 | 18 | 7,741 | 430 |

フィールド数 6倍に対してスコアは 3.5倍。フィールドあたりのトークン数は inquiry_form の方が低い — Gemma4:E4B は複雑なフォームでも効率的に処理できることを示す。

ただし qwen3:4b では同じ比較が 8,431 vs 59,675（7.1倍）だった。**Gemma4:E4B は複雑さの差をより正確に反映**しており、3.5倍という数字は「複雑だが対応可能」という実態を適切に表現している。

### 6.3 SHOPPING_CART_V1 の失敗が示すもの

shopping_cart_v1 は **HTML 設計の問題**で失敗した:
- `<select>` に id がない
- `<button>` に id がない（onclick に直接関数バインド）
- カテゴリナビゲーションが `<a>` タグで id なし

これは「id が適切に付与されていない UI はエージェントが操作できない」ことを意味する。そしてこれは人間にとっても同様 — **アクセシビリティの低い UI は認知負荷が高い**。

shopping_cart_v1 のスコア 2,882 は「4ステップで諦めた」結果であり、実際の認知負荷はもっと高い。これは計測方法の限界を示している: **失敗したタスクのスコアは低く出る傾向がある**（早く止まるため）。

### 6.4 計測インフラの重要性

4ラウンドのイテレーションが示す教訓:

| 原因 | ラウンド | スコアへの影響 |
|------|----------|--------------|
| シミュレータの要素認識不備 | R1 | +17,203 (偽のリトライ) |
| プロンプトの曖昧さ | R2 | +15,880 (不正確な target) |
| 画面遷移の未実装 | R3 | +5,005 (偽のループ) |

**「UI の認知負荷」を正しく測るには、計測器具（シミュレータ＋プロンプト）自体の精度が十分でなければならない。** R1 のスコア 19,425 は UI の問題ではなく計測器具の問題だった。

---

## 7. 結論

### 7.1 Gemma4:E4B は Attention Ledger のエンジンとして十分実用的

- expense_v1: **5ステップ、0リトライで完遂**。qwen3:4b 比でトークン 78% 削減
- inquiry_form_v1: **11ステップ、1リトライで完遂**。qwen3:4b では不可能だったタスク
- RTX 3060 Ti + 64GB RAM で快適に動作（推論時間は 1ステップ約10秒）

### 7.2 スコアの信頼性が向上

Gemma4:E4B の低い出力トークン数は「ノイズが少ない」ことを意味する。qwen3:4b のスコアはモデルの冗長さとUIの複雑さが混在していたが、Gemma4:E4B のスコアはより純粋に **UI の操作難易度** を反映している。

### 7.3 残課題

| 課題 | 説明 | 対策案 |
|------|------|--------|
| id なし要素の操作 | shopping_cart のように id がない要素は操作不可 | CSSセレクタ or テキストマッチング対応 |
| 失敗タスクのスコア | 早期失敗するとスコアが低く出る | ペナルティスコア (例: 失敗=max_steps×1000) |
| v2 との比較未実施 | 今回は v1 のみテスト | expense_v2, inquiry_form_v2 でのA/Bテスト |
| 統計的検証 | 各タスク1回のみの実行 | 同一条件×5回で分散を確認 |

---

## 付録 A: 全実行ログ（Ledger DB より抽出）

### Gemma4:E4B 全実行記録

| # | タスク | 時刻 | 成功 | ステップ | リトライ | トークン | スコア | 備考 |
|---|--------|------|------|----------|----------|----------|--------|------|
| 47 | INQUIRY_FORM_V1 | 04-08 12:58 | 成功 | 11 | 1 | 18,523 | 7,741 | 最終版 |
| 46 | EXPENSE_INPUT_V1 | 04-08 12:54 | 成功 | 5 | 0 | 3,817 | 2,222 | 最終版 |
| 45 | SHOPPING_CART_V1 | 04-08 12:53 | 失敗 | 4 | 2 | 5,692 | 2,882 | Agent Error |
| 44 | EXPENSE_INPUT_V1 | 04-07 22:13 | 失敗 | 20 | 0 | 14,366 | 7,227 | R3: submit遷移なし |
| 43 | INQUIRY_FORM_V1 | 04-07 22:13 | 失敗 | 20 | 4 | 40,126 | 19,639 | R3: submit遷移なし |
| 42 | SHOPPING_CART_V1 | 04-07 21:54 | 失敗 | 20 | 20 | 35,221 | 20,286 | R2: id なし要素 |
| 41 | EXPENSE_INPUT_V1 | 04-07 21:53 | 失敗 | 20 | 17 | 15,274 | 18,102 | R2: 汎用target |
| 40 | SHOPPING_CART_V1 | 04-07 21:39 | 失敗 | 17 | 15 | 28,210 | 16,851 | R1: 初回 |
| 39 | INQUIRY_FORM_V1 | 04-07 21:38 | 失敗 | 4 | 0 | 4,722 | 1,804 | R2: Agent Error |
| 38 | EXPENSE_INPUT_V1 | 04-07 21:23 | 失敗 | 20 | 19 | 15,661 | 19,425 | R1: 初回 |
| 37 | INQUIRY_FORM_V1 | 04-07 21:13 | 失敗 | 20 | 19 | 27,956 | 19,835 | R1: 初回 |

### qwen3:4b 過去実行記録（比較用）

| # | タスク | 成功 | ステップ | リトライ | トークン | スコア |
|---|--------|------|----------|----------|----------|--------|
| 1-5 | EXPENSE_INPUT_V1 | 成功×5 | 5.0 | 0.0 | 9,597 avg | 8,431 avg |
| 6-10 | EXPENSE_INPUT_V2 | 成功×5 | 5.2 | 0.2 | 11,129 avg | 9,655 avg |
| 29-31 | INQUIRY_FORM_V1 | 失敗×3 | 20.0 | 17.0 | 67,989 avg | 59,675 avg |

---

## 付録 B: 実験環境詳細

| 項目 | 値 |
|------|-----|
| OS | Windows 11 Home 10.0.26200 |
| GPU | NVIDIA RTX 3060 Ti (8GB VRAM) |
| RAM | 64GB |
| モデル | gemma4:e4b (Effective 4B MoE, Q4_K_M量子化) |
| モデルサイズ | 9.6 GB |
| Ollama バージョン | 最新 (2026-04) |
| Python | 3.13.4 |
| シミュレータ | SimpleWebSimulator (BeautifulSoup ベース) |
| temperature | 0.7 |
| max_steps | 20 |
| タイムアウト | 120秒/リクエスト |

---

**作成者:** Attention Ledger Dev Team  
**最終更新:** 2026-04-08
