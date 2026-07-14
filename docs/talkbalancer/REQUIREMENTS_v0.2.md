# TalkBalancer 要件定義書 v0.2

**Last Updated:** 2026-06-09
**Status:** Draft
**前提:** 「携帯/iPad＋USB-Cマイクで配布」「自宅PCで処理」「将来ラズパイ化・EC2化」の整合を取った版

---

## 1. プロダクト概要

TalkBalancer は、飲み会・懇親会・社内交流会などで、**会話の偏り・騒音・危ない話題・一人語り**を可視化し、場を壊さずに丁重に指摘するためのアプリである。

中心価値は、音声AIそのものではなく、

> 酒が入る前に場のルールを宣言し、
> 酒が入った後に人間が言いにくい注意を、
> アプリが丁重に表示すること。

である。

---

## 2. 解決するペイン

### P-01 話しすぎる人がいると飲み会がつまらない

よくある状態：

- 一人がずっと話す
- 武勇伝が長い
- 説教が始まる
- 同じ話を繰り返す
- 若手・女性・静かな人が話せない
- 場の主導権を持つ人に誰も注意できない

TalkBalancer は、発話量や話者偏りを可視化し、次のように表示する。

> Aさんタイムが少し長めです。
> そろそろ別の人にも振ると、さらに良い場になりそうです。

### P-02 うるさすぎて話ができない

よくある状態：

- 店内がうるさすぎる
- 声を張らないと聞こえない
- 全体会話が成立しない
- 会話が分断される
- 疲れる
- 不快になる

TalkBalancer は、マイクで騒音レベルを測り、次のように表示する。

> 店内音量が高めです。
> 全体会話より、近い人同士の会話が向いていそうです。

### P-03 酒が入るとコンプラ事故が起きやすい

目的は、特定の年齢層や属性を攻撃することではない。
ただし実務上は、年長者・上位者・声の大きい人・酒が入った人による以下の行動を、やわらかく抑止する。

- 容姿いじり
- 年齢いじり
- 結婚・子ども・恋愛への詮索
- 家庭事情への踏み込み
- セクハラっぽい話
- パワハラっぽい説教
- 若手いじり
- 女性いじり
- 昔の武勇伝の押しつけ
- 政治・宗教・国籍・属性への不用意な発言

表示例：

> この話題は少しセンシティブです。
> 個人事情には踏み込みすぎない方がよさそうです。

---

## 3. 基本コンセプト

### キャッチコピー

**飲み会に、やさしいブレーキを。**

または、

**話しすぎ・うるさすぎ・言いすぎを、場の空気を壊さず整える。**

### プロダクトの本質

TalkBalancer は、次の3つを組み合わせる。

1. 酒が入る前の事前宣言
2. テーブル上の会話バランスメーター
3. 幹事が押せる丁重アラート

音声解析やAIは、その後に足す。

最初から完全自動検出を狙うより、
**「場に置ける」「宣言できる」「丁重に止められる」** ことを優先する。

---

## 4. 利用形態

### 4.1 標準利用イメージ

- テーブル中央に iPad またはスマホを置く
- USB-Cマイクを接続する
- 画面を常時表示する
- 自宅PCまたはローカルサーバーに音声メトリクスを送る
- 幹事はスマホからリモコン操作できる

### 4.2 配布キット構成

将来的には、以下のような TalkBalancer Kit として配布する。

```text
TalkBalancer Kit
├─ Androidスマホ または iPad
├─ USB-C会議用マイク
├─ USB-Cケーブル
├─ スマホ/タブレットスタンド
├─ モバイルバッテリー
├─ 開始前説明カード
├─ QRコード接続カード
└─ 簡易マニュアル
```

---

## 5. 推奨ハードウェア方針

### 5.1 マイク選定の結論

TalkBalancer の標準マイクは、スマホ用の高音質マイクではなく、**テーブル中央に置ける会議用マイク/スピーカーフォン系**がよい。

理由：

- 複数人を同時に拾う必要がある
- テーブル中央に置く
- 遠目の声も拾いたい
- 騒音環境で使う
- 将来ラズパイにもつなぎたい
- USBオーディオデバイスとして扱いたい

AppleのLogic Pro for iPadの公式ガイドでも、USB-CポートにUSBマイクを接続できると案内されている。つまりiPad運用は現実的である。
Android側も、Android Open Source ProjectのUSB digital audioページで、AndroidのUSBデジタルオーディオ対応が整理されている。
ただしOSのUSBオーディオ対応は、個別製品が対象端末のWebブラウザで入力デバイスとして使えることを保証しない。端末・OS・給電・ブラウザを含む組み合わせを購入前に実機確認する。

### 5.2 候補マイク

| 製品 | 位置づけ |
| --- | --- |
| Jabra Speak2 55 MS | 標準配布候補（対象端末で接続検証必須） |
| Anker PowerConf S3 | 安価な標準候補（対象端末で接続検証必須） |
| Anker PowerConf S500 | 上位候補 |
| Audio-Technica ATR4697-USB | USB-C有線入力の初期検証候補 |
| PR-SK95CK USB-C スピーカーフォン | 廉価比較用 |
| SHURE MV88+ | 高音質検証用 |
| RØDE VideoMic Me-C+ | スマホ直結検証 |
| RØDE Wireless Micro | 個別収音向け |
| SENNHEISER XS LAV USB-C | 個人装着向け |

価格と販売SKUは変動するため、購入時にメーカー公式情報と販売店で確認する。

### 5.3 標準候補

#### 第1候補：Jabra Speak2 55

位置づけ：

- 標準配布キット向け
- 4〜6人程度のテーブルに置く想定
- 法人向けにも見せやすい

Jabra Speak2 55は、Jabra公式でプロフェッショナル向けスピーカーフォンとして説明されており、Speak2シリーズの資料ではフルデュプレックス音声を特徴として挙げている。
公式の接続説明はPCがUSB、スマホ・タブレットがBluetoothである。TalkBalancerで使う端末とブラウザの組み合わせは購入前に検証する。

#### 第2候補：Anker PowerConf S3

位置づけ：

- コストを抑えた標準候補
- 自分用MVP・小規模配布向け

Anker PowerConf S3は、AnkerWork公式でBluetoothスピーカーフォンとして掲載され、24時間利用や主要会議サービスとの互換性が説明されている。
公式の接続説明は電話がBluetooth、PCがUSB-Cであるため、タブレットの有線入力は実機確認する。

#### 第3候補：Anker PowerConf S500

位置づけ：

- 上位キット候補
- 音質重視
- 会議室・やや広めのテーブル向け

### 5.4 廉価検証用

#### Audio-Technica ATR4697-USB

位置づけ：

- 安価な卓上マイク検証
- まず音声取得できるか試す
- 公式にPC・タブレット・スマホへのUSB-C接続と360度収音が案内されている
- ただし実際の飲み会ノイズでの精度は実機評価する

#### PR-SK95CK USB-Cスピーカーフォン

位置づけ：

- 廉価MVP検証用
- 量産前の試作・比較用

### 5.5 非標準だが検証価値あり

#### Shure MV88+ / MV88 USB-C

Shure MV88+は、Shure公式ガイドでLightningまたはUSB-Cでモバイル端末に直接接続するコンデンサーマイクとして説明されている。
また、2026年発表のMV88 USB-Cは、Android/iOSのスマホ・タブレットへUSB-Cで直接接続できる製品として発表されている。

ただし、TalkBalancer標準キットとしては少し違う。

- 高音質だが、基本は収録・動画・インタビュー寄り
- テーブル全員を公平に拾う用途では会議用マイクが優先

#### RØDE VideoMic Me-C+ / VideoMic GO II

RØDE系はスマホ直結・動画収録では良い。Apple StoreでもRØDE VideoMic Me C+はiPhone/iPad向けUSB-Cマイクとして扱われている。
またRØDE VideoMic GO IIは、デスクトップUSBマイクとしても使えると公式に説明されている。

ただし、方向性があるマイクは「テーブル全員を公平に拾う」用途とはズレやすい。

---

## 6. ハードウェア構成案

### 6.1 MVP構成

```text
Androidスマホ or iPad
＋
USB-C会議用マイク
＋
自宅PC Local Server
```

処理分担：

```text
スマホ/iPad：
- マイク入力
- 画面表示
- 幹事リモコン
- 音声チャンク送信

USB-Cマイク：
- テーブル会話収音
- 騒音取得
- 発話区間検出用音声取得

自宅PC：
- WebSocket受信
- 音量解析
- 発話区間検出
- 話者分離
- 文字起こし
- LLM判定
- ダッシュボード配信
```

### 6.2 配布版キット

#### TalkBalancer Kit Lite

- Androidスマホ
- USB-C廉価マイク
- 簡易スタンド
- USB-Cケーブル
- 説明カード

用途：

- 個人利用
- 検証
- 小規模飲み会

#### TalkBalancer Kit Standard

- Androidスマホ or iPad
- Jabra Speak2 55 / Anker PowerConf S3
- タブレットスタンド
- モバイルバッテリー
- QRコード接続カード
- 説明カード

用途：

- 社内懇親会
- 飲み会
- 4〜6人程度

#### TalkBalancer Kit Pro

- iPad
- 上位スピーカーフォン
- 幹事スマホ連携
- Local Server
- レポート機能

用途：

- 法人向け
- コンプラ予防
- 研修
- ファシリテーション支援

---

## 7. 将来ラズパイ化

### 7.1 ラズパイ化の目的

自宅PC常駐は最初の開発にはよい。
ただし配布・サービス化を考えると、将来的には専用ローカル機器にした方がよい。

```text
TalkBalancer Box
=
Raspberry Pi
＋
USBマイク
＋
ローカル処理
＋
Web画面配信
```

Raspberry Pi側は、USBマイクまたはUSBオーディオ機器を接続する構成が現実的である。Raspberry Pi公式ドキュメントにはAudio HATであるCodec Zeroなどの音声アクセサリもあるが、TalkBalancerではまずUSBマイク/USBスピーカーフォンの方が移植しやすい。

### 7.2 ラズパイ版構成

```text
[USB-Cマイク / USB-Aマイク]
        ↓
[Raspberry Pi 5]
        ↓
[FastAPI / WebSocket / Local DB]
        ↓
[iPad / スマホのブラウザ表示]
```

ラズパイ側でやること：

- 音声入力
- VAD
- 音量解析
- 簡易話者分離
- WebSocket配信
- ローカルDB保存

重い処理は段階的にする。

- 軽量版：音量・発話区間のみ
- 標準版：話者クラスタ推定
- 上位版：文字起こし・LLM分析

### 7.3 ラズパイで避けること

最初からラズパイ単体で全部やらない。

避けるもの：

- リアルタイムWhisper
- 高精度話者分離
- 長時間文字起こし
- ローカルLLMによる高度判定

ラズパイ版はまず、

- 音量
- 騒音
- 発話密度
- 幹事アラート
- 画面配信

に絞る。

---

## 8. システム構成

### 8.1 Local PC版

```text
┌────────────────────┐
│ iPad / Android Phone│
│ Table Display       │
│                    │
│ - PWA              │
│ - USB-C Mic Input  │
│ - Screen Wake Lock │
│ - WebSocket Client │
└─────────┬──────────┘
          │
          │ Audio Metrics / Audio Chunks
          ↓
┌────────────────────┐
│ Home PC Local Server│
│                    │
│ - FastAPI          │
│ - WebSocket        │
│ - Audio Buffer     │
│ - VAD              │
│ - Whisper optional │
│ - Diarization opt. │
│ - LLM optional     │
│ - SQLite/Postgres  │
└─────────┬──────────┘
          │
          │ Analysis Result
          ↓
┌────────────────────┐
│ Table Display       │
│                    │
│ - Balance Score    │
│ - Noise Score      │
│ - Alerts           │
│ - Report           │
└────────────────────┘
```

### 8.2 Raspberry Pi版

```text
┌────────────────────┐
│ USB-C/USB Mic       │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Raspberry Pi        │
│ TalkBalancer Box    │
│                    │
│ - Audio Capture    │
│ - VAD              │
│ - Noise Meter      │
│ - Web Server       │
│ - WebSocket        │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ iPad / Phone Browser│
│                    │
│ - Table Display    │
│ - Remote Control   │
└────────────────────┘
```

### 8.3 将来クラウド版

```text
┌────────────────────┐
│ iPad / Phone + Mic  │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Cloud Ingest        │
│ EC2 / ECS / GPU     │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Cloud Analysis      │
│ Whisper / LLM       │
└─────────┬──────────┘
          ↓
┌────────────────────┐
│ Dashboard / Report  │
└────────────────────┘
```

クラウド版に行く場合も、抽象化しておく。

- AudioInputProvider
- AnalysisProvider
- DiarizationProvider
- TranscriptionProvider
- LLMProvider
- StorageProvider

---

## 9. 機能要件

### F-01 開始前宣言

飲み会開始前に、以下の宣言を表示する。

> 今日は、全員が気持ちよく話せる飲み会にします。
>
> ・一人が話しすぎない
> ・他の人にも話を振る
> ・容姿、年齢、結婚、子ども、恋愛、家庭事情を不用意にいじらない
> ・説教や武勇伝が長くなりすぎたら一度止める
> ・店内がうるさすぎる場合は、無理に全体会話を続けない
> ・TalkBalancerの表示は、個人攻撃ではなく場を整える合図とします

### F-02 同意確認

開始前に、解析モードを選ぶ。

- モードA：音量のみ
- モードB：音量＋発話バランス
- モードC：文字起こしあり

初期設定：

- 録音保存：OFF
- 文字起こし：OFF
- クラウド送信：OFF

### F-03 USB-Cマイク入力

スマホ/iPadはUSB-Cマイクから音声入力を取得する。

要件：

- 外部マイクを認識できる
- 内蔵マイクと外部マイクを区別できる
- 入力レベルを表示できる
- 接続切断を検知できる
- マイク未接続時は警告を出す

表示例：

```text
外部マイク：接続済み
入力レベル：正常
録音保存：OFF
```

### F-04 テーブル表示モード

iPadまたはスマホをテーブル中央に置く。

表示項目：

- 会話バランススコア
- 店内音量
- 話しすぎ傾向
- 沈黙傾向
- 話題ループ候補
- 丁重アラート
- 現在の解析モード

表示例：

```text
会話バランス：68点
店内音量：高め
Aさんタイムが少し長めです

そろそろ別の人にも振ると、
さらに良い場になりそうです。
```

### F-05 幹事リモコン

幹事のスマホから、テーブル画面に丁重アラートを出せる。

ボタン：

- 話しすぎ
- うるさすぎ
- 同じ話
- 説教っぽい
- センシティブ話題
- 他の人にも振る
- 話題転換
- 水を飲む
- 休憩

### F-06 丁重アラート表示

アラート文言は、命令・断定・個人攻撃を避ける。

例：

> 少し一方向の会話が続いています。
> ここで一度、相手の話も聞いてみましょう。

> この話題は少しセンシティブです。
> 個人事情には踏み込みすぎない方がよさそうです。

> 店内音量が高めです。
> 全体会話より、近い人同士の会話が向いていそうです。

### F-07 音量・騒音解析

外部マイク入力から以下を計算する。

- RMS音量
- ピーク音量
- 騒音レベル
- 音声らしさ
- 会話しやすさスコア

### F-08 発話区間検出

VADにより、発話らしき区間を検出する。

- 発話あり
- 無音
- 騒音
- かぶり発話

MVPでは、話者識別は必須ではない。

### F-09 話者分離

将来機能。

- speaker_1
- speaker_2
- speaker_3
- unknown

最初は名前ではなく仮ラベルでよい。

### F-10 文字起こし

文字起こしは、明示同意がある場合のみ。

- 録音あり
- 文字起こしあり
- ローカル処理
- 保存ポリシー表示

### F-11 同じ話判定

文字起こしONの場合のみ実装。

検出対象：

- 同じ話題
- 同じエピソード
- 同じ愚痴
- 同じ武勇伝
- 同じ説教

表示：

> この話題は一度出ています。
> 少し別の話題に移ると、会話が広がりそうです。

---

## 10. 非機能要件

### 10.1 プライバシー

- 初期設定では録音しない
- 初期設定では文字起こししない
- クラウド送信しない
- ローカルPC内で処理する
- 解析モードを常時表示する
- 終了時にデータ削除できる

画面に必ず表示：

```text
録音保存：OFF
文字起こし：OFF
クラウド送信：OFF
```

### 10.2 精度要件

MVP段階：

- 騒音レベル：実用レベル
- 発話あり/なし：参考値
- 話者分離：将来機能
- 文字起こし：同意時のみ
- コンプラ判定：最初は手動ボタン優先

### 10.3 可搬性

- スマホ単体で動く
- iPadでも動く
- USB-Cマイクを差し替えられる
- 自宅PCで処理できる
- 将来ラズパイに移植できる
- 将来EC2に移せる

---

## 11. 技術スタック

### Frontend

- Next.js
- TypeScript
- PWA
- Web Audio API
- MediaDevices.getUserMedia
- WebSocket
- Recharts
- Tailwind CSS
- shadcn/ui

### Local Server

- Python
- FastAPI
- WebSocket
- Docker Compose
- SQLite
- faster-whisper / whisper.cpp optional
- pyannote optional
- Ollama optional

### Raspberry Pi版

- Raspberry Pi 5
- Python
- FastAPI
- WebSocket
- ALSA / PipeWire
- USB audio device
- SQLite

---

## 12. データモデル

### Session

```typescript
type Session = {
  id: string
  title: string
  startedAt: string
  endedAt?: string
  mode: "volume_only" | "balance" | "transcript"
  deviceType: "phone" | "ipad" | "raspberry_pi" | "pc"
  micType: string
  savePolicy: "none" | "metrics_only" | "full_local"
}
```

### AudioDevice

```typescript
type AudioDevice = {
  id: string
  name: string
  connection: "usb_c" | "usb_a" | "built_in" | "bluetooth"
  isExternal: boolean
  sampleRate?: number
  channels?: number
}
```

### AudioMetric

```typescript
type AudioMetric = {
  sessionId: string
  timestamp: string
  rms: number
  peak: number
  noiseLevel: number
  speechProbability: number
}
```

### AlertEvent

```typescript
type AlertEvent = {
  sessionId: string
  timestamp: string
  type:
    | "talk_too_much"
    | "too_loud"
    | "same_story"
    | "preaching"
    | "sensitive_topic"
    | "topic_shift"
    | "drink_water"
  source: "manual" | "auto"
  message: string
  severity: "info" | "notice" | "strong"
}
```

---

## 13. 開発ロードマップ

### Step 1：手動アラートMVP

最初に作る。

- テーブル表示画面
- 幹事リモコン
- 開始前宣言
- 丁重アラート表示
- 録音なし
- 文字起こしなし

ここが一番価値に直結する。

### Step 2：USB-Cマイク対応

- 外部マイク認識
- 音量表示
- マイク接続状態表示
- 入力テスト画面

### Step 3：Local PC連携

- スマホ/iPad → 自宅PC
- WebSocket接続
- 音声メトリクス送信
- PC側で解析
- 結果を画面に返す

### Step 4：騒音・会話密度メーター

- 騒音レベル
- 会話密度
- 沈黙
- かぶり発話
- 会話しやすさスコア

### Step 5：話者分離・文字起こし

- 話者クラスタ
- Whisper
- 同じ話判定
- コンプラ危険話題の補助判定

### Step 6：ラズパイ化

- TalkBalancer Box
- USBマイク接続
- Web画面配信
- ローカル完結
- 配布キット化

---

## 14. 実装エージェント投入用プロンプト

```markdown
# TalkBalancer 要件定義

## 目的
TalkBalancerは、飲み会・懇親会・社内交流会で、話しすぎ、騒音、同じ話のループ、センシティブ話題、酒席でのコンプラ事故を防ぐためのアプリである。

## 基本思想
音声AIアプリではなく、飲み会の事前合意と丁重なブレーキ役を担うアプリである。

酒が入る前に場のルールを宣言し、酒が入った後に人間が直接注意しづらい内容を、アプリが丁重な文言でテーブル画面に表示する。

## 利用形態
- iPadまたはAndroidスマホをテーブル中央に置く
- USB-C会議用マイクを接続する
- 画面を常時表示する
- 重い解析は自宅PCのLocal Serverで行う
- 将来的にはLocal ServerをRaspberry PiまたはEC2に置き換えられるようにする

## ハードウェア
### 標準構成
- iPadまたはAndroidスマホ
- USB-C会議用マイク
- タブレットスタンド
- モバイルバッテリー
- QRコード接続カード

### マイク候補
- Jabra Speak2 55
- Anker PowerConf S3
- Anker PowerConf S500
- Audio-Technica ATR4697-USB
- 廉価USB-Cスピーカーフォン

## MVP範囲
### MVP 1
- 開始前宣言画面
- 幹事リモコン
- 丁重アラート表示
- テーブル表示モード
- 録音なし
- 文字起こしなし

### MVP 2
- USB-Cマイク認識
- 音量表示
- 騒音レベル表示
- 会話しやすさスコア

### MVP 3
- 自宅PC Local Server連携
- WebSocket通信
- 音声メトリクス送信
- 発話区間検出
- 直近1分/5分の会話密度表示

## 画面
1. ホーム
2. 開始前宣言
3. 同意確認
4. マイク接続確認
5. テーブル表示モード
6. 幹事リモコン
7. 詳細グラフ
8. 終了レポート
9. 設定

## 開始前宣言
以下を表示する。

「今日は、全員が気持ちよく話せる飲み会にします。
一人が話しすぎないこと、他の人にも話を振ること、個人事情やセンシティブな話題に踏み込みすぎないことを大切にします。
TalkBalancerの表示は、誰かを責めるためではなく、場を整えるための合図です。」

## 幹事リモコン
以下のボタンを持つ。

- 話しすぎ
- うるさすぎ
- 同じ話
- 説教っぽい
- センシティブ話題
- 他の人にも振る
- 話題転換
- 水を飲む
- 休憩

## 丁重アラート文言
- 「Aさんタイムが少し長めです。そろそろ別の人にも振ると、さらに良い場になりそうです。」
- 「店内音量が高めです。全体会話より、近い人同士の会話が向いていそうです。」
- 「この話題は一度出ています。少し別の話題に移ると、会話が広がりそうです。」
- 「少し一方向の会話が続いています。ここで一度、相手の話も聞いてみましょう。」
- 「この話題は少しセンシティブです。個人事情には踏み込みすぎない方がよさそうです。」

## プライバシー
- 初期設定では録音しない
- 初期設定では文字起こししない
- 初期設定ではクラウド送信しない
- 現在の解析モードを画面に常時表示する
- 終了時にデータ削除できる

## 将来拡張
- 話者分離
- Whisper文字起こし
- 同じ話判定
- センシティブ話題検出
- Raspberry Pi版 TalkBalancer Box
- EC2/GPUサーバー版
```

---

## 15. まずの結論

標準構成はこれでよい。

```text
iPad または Androidスマホ
＋
USB-C会議用マイク
＋
自宅PC Local Server
```

最初に作るべきMVPは、

- 録音なし
- 文字起こしなし
- 手動アラートあり
- 開始前宣言あり
- テーブル表示あり
- USB-Cマイク音量取得あり

である。

USB-C有線入力は、まず **Audio-Technica ATR4697-USB** で検証する。
その後、配布運用候補として **Anker PowerConf S3** と **Jabra Speak2 55** を対象端末・ブラウザで比較する。
RØDE/Shure系は高音質だが、TalkBalancerの標準用途では「動画・個人収録向け」に寄るため、標準キットでは会議用マイクを優先した方が整合する。
