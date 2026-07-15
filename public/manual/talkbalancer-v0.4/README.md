# TalkBalancer v0.4 販促・取扱説明画像

v0.3の8枚組資料に、ローカル文字起こし・話者識別を説明する2枚を追加した全10枚の資料です。

## 基本資料

1. [`01-quick-start.png`](../talkbalancer-v0.3/01-quick-start.png) — 表紙と3ステップ概要
2. [`02-value-scenes.png`](../talkbalancer-v0.3/02-value-scenes.png) — 利用シーンと導入メリット
3. [`03-start-consent.png`](../talkbalancer-v0.3/03-start-consent.png) — 開始前宣言・同意・モード選択
4. [`04-live-operation.png`](../talkbalancer-v0.3/04-live-operation.png) — テーブル表示と幹事リモコン
5. [`05-alert-catalog.png`](../talkbalancer-v0.3/05-alert-catalog.png) — 9種の丁寧な通知
6. [`06-report.png`](../talkbalancer-v0.3/06-report.png) — 終了レポートの見方
7. [`07-privacy-logic.png`](../talkbalancer-v0.3/07-privacy-logic.png) — 保存しない設計と削除フロー
8. [`08-hardware-setup.png`](../talkbalancer-v0.3/08-hardware-setup.png) — 推奨機材と設置方法

## v0.4追加資料

9. [`09-local-ai-architecture.png`](./09-local-ai-architecture.png) — 内蔵マイク、ローカルPC、保存なしの構成
10. [`10-speaker-identification-limits.png`](./10-speaker-identification-limits.png) — 話者識別と同時発話の音源分離の違い

![専用マイクなしで使うローカルAI構成](./09-local-ai-architecture.png)

![話者識別と音源分離の違い](./10-speaker-identification-limits.png)

## 説明上の重要事項

- 専用マイクがなくても、スマートフォンまたはPCの内蔵マイクから開始できます。
- ローカル文字起こしと話者識別には、AIモデルを動かすPCが必要です。
- 事前の声登録は不要で、「話者1」「話者2」のように自動分類します。
- 順番に話す人の識別には対応しますが、同時に重なった声を別々の音声へ分離する機能ではありません。
- 録音ファイルを作らず、音声をクラウドへ送信しません。

画像は横長16:9で、アプリ内表示、プレゼン、Web掲載、印刷配布を想定しています。
