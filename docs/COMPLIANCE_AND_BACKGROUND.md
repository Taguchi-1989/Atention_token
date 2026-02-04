# コンプライアンス & 科学的背景（v0.1）

この文書は、HCI/心理学の理論や関連ツールを商用 + OSS 文脈で扱うための実務的・保守的なガイドです。法的助言ではありません。

---

## 1) 安全側の基本ルール

- 指標・アルゴリズムは **自前実装** を優先する。
- アンケート文面は、ライセンスが明示されていない限り **そのまま再利用しない**。
- 理論・導出は、可能な範囲で出典を明記する。
- 標準化団体・政府・著者の **承認や公式性を示唆しない**。

---

## 2) 理論・文面・コードの扱い

- **理論や数式**（例: Fitts、Hick–Hyman）は、一般に実装自由。
- **アンケート文面**（NASA‑TLX / SUS など）は著作権対象の可能性があるため、明確に許諾がない限り **ライセンスが必要** とみなす。
- **コード** はそのコードのライセンスに従う。許諾のないソースからのコピーは避ける。

---

## 3) 個別項目（MVP関連）

### NASA‑TLX

- NASA NTRS の NASA‑TLX パッケージは「Work of the US Gov. Public Use Permitted」と記載されている。
- NASA のロゴ・徽章は別のブランド規定があるため、明確な許可なしに使用しない。

**Recommended wording:** “NASA‑TLX inspired” + cite NASA TLX as source.

---

### SUS（System Usability Scale）

- SUS は John Brooke によって作成され広く使われている。
- 公的資料には由来の説明はあるが、**設問文の明示的な再利用ライセンスは確認できない**。明確な許諾がない限り、設問文は **言い換え** を推奨。

**Safe rule:** use **paraphrased or independently phrased items** and describe them as “SUS‑inspired.”  
If you need the official wording, obtain clear permission or confirm license status for the specific translation/version.

---

### ISO の定義（例: ISO 9241‑11）

- ISO 規格は有償で提供されるため、本文の転載は避け、**規格名の引用に留める**。

---

### コンピュータビジョン系（OpenCV）

- OpenCV 4.5.0 以降は Apache 2.0、4.4.0 以下は BSD‑3‑Clause。

**Action:** record the OpenCV version and license in your dependency list.

---

## 4) “Inspired by” 表現（推奨）

次のような表現が安全：

- “inspired by”
- “HCI/心理学の既存研究に基づく”
- “heuristic（近似指標）”

公式・標準化された指標と誤認されるリスクを下げられる。

---

## 5) README 用ポリシー（コピペ可）

> 本プロジェクトは、認知心理学・HCI・情報理論の既存研究に着想を得ています。  
> すべての指標・アルゴリズムは独自実装であり、特定の標準化手法や専有的な計測手法の公式再現ではありません。

---

## 6) コンプライアンス TODO（後で）

- **SUS の翻訳版** を使う場合、必ずライセンス確認。
- **第三者の saliency / clutter 実装** を使う場合、必ずライセンス確認。
- NASA‑TLX の文面を直接引用する場合、出典記録を残す。

---

## 確認したソース

- NASA NTRS: NASA Task Load Index (TLX) パッケージ  
  https://ntrs.nasa.gov/citations/20000021488
- OpenCV ライセンス  
  https://opencv.org/license/
- ISO 9241‑11 商品ページ（有償）  
  https://online.standard.no/en/iso-9241-11-1998
- Usability Body of Knowledge: SUS 概要  
  https://usabilitybok.org/sus
