import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BatteryCharging,
  Cable,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Mic,
  MonitorSpeaker,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
  Volume2,
} from 'lucide-react';

export type PartyPhase = {
  title: string;
  timing: string;
  icon: LucideIcon;
  goal: string;
  actions: string[];
};

export type TriggerCard = {
  title: string;
  signal: string;
  action: string;
  tone: 'primary' | 'warning' | 'error' | 'success';
};

export type KitTier = {
  name: string;
  badge: string;
  bestFor: string;
  primaryMic: string;
  icon: LucideIcon;
  items: string[];
  reasons: string[];
};

export type MicCandidate = {
  name: string;
  rank: string;
  fit: string;
  recommendation: '標準候補' | '安価な標準候補' | '上位候補' | '検証候補' | '非標準候補';
  sourceUrl: string;
  sourceLabel: string;
  strengths: string[];
  cautions: string[];
};

export const PARTY_PHASES: PartyPhase[] = [
  {
    title: '開始前',
    timing: '乾杯前 3分',
    icon: ClipboardCheck,
    goal: '場のルールを先に共有し、あとから注意しやすい空気を作る。',
    actions: [
      'テーブル中央に端末とマイクを置く',
      '開始前宣言を全員に見せる',
      '録音保存OFF・文字起こしOFF・クラウド送信OFFを確認する',
      '幹事リモコンを幹事のスマホで開く',
    ],
  },
  {
    title: '序盤',
    timing: '開始 0〜20分',
    icon: Users,
    goal: '全員が一度は話せる状態を作る。',
    actions: [
      'テーブル表示を常時表示にする',
      '会話が一方向になったら「他の人にも振る」を出す',
      '店内が騒がしい場合は無理に全体会話を続けない',
      '静かな人を個名で責めず、場全体への合図として扱う',
    ],
  },
  {
    title: '中盤',
    timing: '酒が回り始めた頃',
    icon: AlertTriangle,
    goal: '話しすぎ、説教、センシティブ話題を早めにやわらげる。',
    actions: [
      '幹事リモコンで丁重アラートを出す',
      'アラート後は話題転換か水を飲む導線につなげる',
      '同じ話が続く場合は「話題転換」を優先する',
      'センシティブ話題は早めに止め、個人事情に踏み込まない',
    ],
  },
  {
    title: '終了前',
    timing: 'ラスト 5分',
    icon: ShieldCheck,
    goal: '場を責めずに振り返り、データを残さず閉じる。',
    actions: [
      '終了レポートでアラート内訳を確認する',
      '良かった流れと次回の改善だけを見る',
      'セッションを終了して一時データを削除する',
      '録音や文字起こしが残っていないことを確認する',
    ],
  },
];

export const TRIGGER_CARDS: TriggerCard[] = [
  {
    title: '一人の話が長い',
    signal: '同じ人の発話が続き、相づちだけの人が増える。',
    action: '「他の人にも振る」か「話しすぎ」を表示する。',
    tone: 'primary',
  },
  {
    title: '店内がうるさい',
    signal: '聞き返し、声の張り上げ、会話の分断が増える。',
    action: '「うるさすぎ」を表示し、近い人同士の会話へ切り替える。',
    tone: 'warning',
  },
  {
    title: '危ない話題',
    signal: '容姿、年齢、結婚、恋愛、家庭事情、属性の話が深くなる。',
    action: '「センシティブ話題」を早めに表示し、話題転換する。',
    tone: 'error',
  },
  {
    title: '疲れが見える',
    signal: '沈黙、スマホを見る、表情が固い、離席が増える。',
    action: '「水を飲む」か「休憩」を表示して空気をリセットする。',
    tone: 'success',
  },
];

export const KIT_TIERS: KitTier[] = [
  {
    name: 'TalkBalancer Kit Lite',
    badge: 'まず検証',
    bestFor: '自分用MVP、小規模飲み会、2〜4人',
    primaryMic: 'Audio-Technica ATR4697-USB',
    icon: Smartphone,
    items: [
      'AndroidスマホまたはiPad',
      'Audio-Technica ATR4697-USB',
      '小型スタンド',
      'USB-Cケーブル',
      'モバイルバッテリー',
    ],
    reasons: [
      '公式にPC・タブレット・スマホへのUSB-C接続が案内されている',
      '360度収音で、まずWeb Audio APIの入力とテーブル中央収音を試せる',
    ],
  },
  {
    name: 'TalkBalancer Kit Standard',
    badge: '標準推奨',
    bestFor: '社内懇親会、4〜6人テーブル、配布キット',
    primaryMic: 'Jabra Speak2 55',
    icon: Tablet,
    items: [
      'iPadまたはAndroidタブレット（接続実機検証済みの組み合わせ）',
      'Jabra Speak2 55',
      '安定したタブレットスタンド',
      'Jabra付属USBケーブル（PC検証用）',
      '開始前説明カードとQRコードカード',
    ],
    reasons: [
      '会議用スピーカーフォンとして見た目と運用が安定している',
      '4つのビームフォーミングマイクとフルデュプレックス対応で、テーブル中央設置と相性がよい',
    ],
  },
  {
    name: 'TalkBalancer Kit Pro',
    badge: '法人・広め',
    bestFor: '研修、法人イベント、やや広めのテーブル',
    primaryMic: 'Anker PowerConf S500',
    icon: MonitorSpeaker,
    items: [
      'iPad',
      'Anker PowerConf S500',
      '幹事スマホ',
      'Local Server PC',
      'レポート確認用の大きめ画面',
    ],
    reasons: [
      'USB-C、Bluetooth、付属ドングルで接続の選択肢が多い',
      '4マイク、32kHzサンプリング、フルデュプレックスの仕様で、上位検証に向く',
    ],
  },
];

export const MIC_CANDIDATES: MicCandidate[] = [
  {
    name: 'Jabra Speak2 55',
    rank: '第1候補',
    fit: '標準配布キット',
    recommendation: '標準候補',
    sourceUrl: 'https://www.jabra.com/business/speakerphones/jabra-speak-series/jabra-speak2-55',
    sourceLabel: 'Jabra 公式',
    strengths: [
      '4つのビームフォーミングマイク',
      'フルデュプレックス音声',
      'PC向けUSB-C / USB-A、スマホ・タブレット向けBluetoothに対応',
      '最大12時間のワイヤレス通話',
    ],
    cautions: [
      '標準候補としては価格が上がりやすい',
      '公式案内では有線接続はPC向け、スマホ・タブレットはBluetooth接続のため、対象端末のブラウザ入力を購入前に実機確認する',
    ],
  },
  {
    name: 'Anker PowerConf S3',
    rank: '第2候補',
    fit: '低コストMVP',
    recommendation: '安価な標準候補',
    sourceUrl: 'https://us.ankerwork.com/products/a3302',
    sourceLabel: 'AnkerWork 公式',
    strengths: [
      '6マイク構成',
      '24時間通話時間',
      'USB-C とBluetoothに対応',
      '小規模検証で導入しやすい',
    ],
    cautions: [
      '法人配布キットの見た目や管理性はJabra系が扱いやすい場合がある',
      '日本販売SKUや同梱品は購入先で確認する',
      '公式案内では電話はBluetooth、PCはUSB-C接続のため、タブレットの有線入力は実機確認する',
    ],
  },
  {
    name: 'Anker PowerConf S500',
    rank: '第3候補',
    fit: '上位キット',
    recommendation: '上位候補',
    sourceUrl: 'https://us.ankerwork.com/products/a3305',
    sourceLabel: 'AnkerWork 公式',
    strengths: [
      '4マイク、32kHzサンプリング',
      'VoiceRadar 技術',
      'USB-C、Bluetooth、付属ドングルに対応',
      'やや広い場の検証に向く',
    ],
    cautions: [
      'TalkBalancer MVPには過剰になる可能性がある',
      'まずStandardで運用価値を確認してから上位化する',
    ],
  },
  {
    name: 'Audio-Technica ATR4697-USB',
    rank: '有線MVP候補',
    fit: 'USB-C入力の初期検証',
    recommendation: '検証候補',
    sourceUrl: 'https://www.audio-technica.com/en-us/atr4697-usb',
    sourceLabel: 'Audio-Technica 公式',
    strengths: [
      '公式にPC・タブレット・スマホへのUSB-C接続が案内されている',
      '360度収音の卓上マイクとして音量取得・接続確認を試しやすい',
    ],
    cautions: [
      'スピーカーフォン型とはノイズ処理が異なるため、混雑した店内で比較評価する',
      '標準キットでは会議用スピーカーフォンを優先する',
    ],
  },
  {
    name: 'Shure MV88+ / RODE VideoMic 系',
    rank: '用途外検証',
    fit: '高音質・動画収録寄り',
    recommendation: '非標準候補',
    sourceUrl: 'https://support.apple.com/guide/logicpro-ipad/connect-external-devices-lpip26513101/ipados',
    sourceLabel: 'Apple 公式',
    strengths: [
      'USB-CマイクやオーディオインターフェースはiPad運用の検証対象にできる',
      '個人収録や動画収録の音質検証には向く',
    ],
    cautions: [
      'テーブル全員を公平に拾う用途では、方向性のあるマイクは標準にしない',
      'TalkBalancerの標準キットは会議用スピーカーフォンを優先する',
    ],
  },
];

export const SETUP_CHECKLIST = [
  { icon: Cable, text: 'マイクはBluetoothより先にUSB接続で検証する' },
  { icon: Mic, text: 'マイク確認画面で外部デバイス名と入力レベルを見る' },
  { icon: Volume2, text: '騒音メーターは乾杯前に一度だけ試す' },
  { icon: BatteryCharging, text: '端末とマイクのバッテリーを開始前に確認する' },
  { icon: Gauge, text: '店内音量が高い日は全体会話に固執しない' },
  { icon: Sparkles, text: 'アラートは個人への指摘ではなく場への合図として扱う' },
  { icon: CheckCircle2, text: '終了レポート確認後にセッションを削除する' },
];

export const COMPATIBILITY_NOTES = [
  {
    title: 'iPad / iPhone',
    text: 'USB-C端子のあるiPadはUSBマイクを直接接続できる。給電不足に備え、必要なら給電対応ハブを使う。',
    sourceUrl: 'https://support.apple.com/guide/logicpro-ipad/connect-external-devices-lpip26513101/ipados',
  },
  {
    title: 'Android',
    text: 'AndroidはUSBデジタルオーディオをサポートするが、端末・OS・USBホスト動作・給電で差が出るため実機確認を必須にする。',
    sourceUrl: 'https://source.android.com/docs/core/audio/usb',
  },
  {
    title: 'Webブラウザ',
    text: 'Web Audio APIではデバイス名がマイク許可後に表示される。まずマイク確認画面で接続状態を見る。',
    sourceUrl: '/talkbalancer/mic',
  },
];
