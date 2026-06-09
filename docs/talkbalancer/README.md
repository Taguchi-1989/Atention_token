# TalkBalancer

飲み会・懇親会・社内交流会で、**話しすぎ・うるさすぎ・言いすぎ**を、場の空気を壊さず整えるアプリのドキュメント置き場。

> 飲み会に、やさしいブレーキを。

本リポジトリ（Attention Ledger）と同じく「人を評価せず、場の構造を整える」思想のプロダクトであり、技術スタック（Next.js + FastAPI + WebSocket + SQLite）も共通基盤を想定している。

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [REQUIREMENTS_v0.2.md](./REQUIREMENTS_v0.2.md) | 要件定義書 v0.2（現行版）。携帯/iPad＋USB-Cマイクで配布、自宅PCで処理、将来ラズパイ化・EC2化の整合を取った版 |

## 要点サマリ

- **中心価値**: 音声AIではなく「酒が入る前のルール宣言」と「人間が言いにくい注意の丁重な代弁」
- **標準構成**: iPad/Androidスマホ ＋ USB-C会議用マイク ＋ 自宅PC Local Server
- **MVP (Step 1)**: 開始前宣言・幹事リモコン・丁重アラート表示・テーブル表示（録音なし・文字起こしなし）
- **プライバシー初期設定**: 録音保存 OFF / 文字起こし OFF / クラウド送信 OFF
- **マイク第1候補**: Jabra Speak2 55 / Anker PowerConf S3
- **将来展開**: Raspberry Pi 版「TalkBalancer Box」→ EC2/GPU クラウド版
