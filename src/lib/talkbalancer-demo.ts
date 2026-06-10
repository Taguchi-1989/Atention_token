// TalkBalancer デモモード（バックエンド未接続時のフォールバック）
//
// GitHub Pages などの静的ホスティングでは FastAPI が存在しないため、
// セッション・アラートを localStorage に保存して同一ブラウザ内で完結させる。
// テーブル表示と幹事リモコンを別タブで開けば、ポーリング経由で連携デモができる。
// 騒音解析はサーバー実装（python/attention_ledger/api/talkbalancer.py）の
// 簡易移植をブラウザ内で行う。データは端末外に一切送信されない。

import type {
  TbSession, TbAlert, TbAnalysis, SessionState, SessionMode, AlertType, NoiseCategory,
} from './talkbalancer';

const KEY = 'talkbalancer_demo_v1';

// サーバー側 _ALERT_MESSAGES と同内容（F-06 丁重アラート文言）
const MESSAGES: Record<AlertType, string> = {
  talk_too_much: 'お話タイムが少し長めです。\nそろそろ別の人にも振ると、さらに良い場になりそうです。',
  too_loud: '店内音量が高めです。\n全体会話より、近い人同士の会話が向いていそうです。',
  same_story: 'この話題は一度出ています。\n少し別の話題に移ると、会話が広がりそうです。',
  preaching: '少し一方向の会話が続いています。\nここで一度、相手の話も聞いてみましょう。',
  sensitive_topic: 'この話題は少しセンシティブです。\n個人事情には踏み込みすぎない方がよさそうです。',
  pass_around: 'まだ話せていない人がいるかもしれません。\n近くの人に話を振ってみましょう。',
  topic_shift: 'ここで少し話題を変えてみるのはどうでしょう。\n新しい話で会話が広がりそうです。',
  drink_water: 'ここで一杯、お水を挟みましょう。\n明日の自分がきっと助かります。',
  take_break: '少し休憩を挟みましょう。\n席を立つと、会話もリフレッシュされます。',
};

const NOTICE_TYPES: AlertType[] = ['preaching', 'sensitive_topic'];

interface DemoState {
  session: TbSession | null;
  seq: number;
  alerts: TbAlert[];
}

function load(): DemoState {
  if (typeof window === 'undefined') return { session: null, seq: 0, alerts: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 壊れたデータは初期化 */ }
  return { session: null, seq: 0, alerts: [] };
}

function save(state: DemoState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* プライベートモード等で保存不可でも動作は継続 */ }
}

export function getSession(): SessionState {
  const s = load();
  return { active: s.session !== null, session: s.session, seq: s.seq };
}

export function startSession(title: string, mode: SessionMode): SessionState {
  const state: DemoState = {
    session: {
      id: Math.random().toString(36).slice(2, 14),
      title,
      startedAt: new Date().toISOString(),
      mode,
      savePolicy: 'none',
    },
    seq: 0,
    alerts: [],
  };
  save(state);
  return { active: true, session: state.session, seq: 0 };
}

export function endSession(): void {
  save({ session: null, seq: 0, alerts: [] });
}

export function postAlert(type: AlertType, source: 'manual' | 'auto' = 'manual'): TbAlert {
  const s = load();
  if (!s.session) throw new Error('セッションが開始されていません');
  const alert: TbAlert = {
    seq: s.seq + 1,
    sessionId: s.session.id,
    timestamp: new Date().toISOString(),
    type,
    source,
    message: MESSAGES[type],
    severity: NOTICE_TYPES.includes(type) ? 'notice' : 'info',
  };
  s.seq = alert.seq;
  s.alerts = [...s.alerts, alert].slice(-20);
  save(s);
  return alert;
}

export function listAlerts(after: number): { alerts: TbAlert[]; seq: number; active: boolean } {
  const s = load();
  return {
    alerts: s.alerts.filter((a) => a.seq > after),
    seq: s.seq,
    active: s.session !== null,
  };
}

// ── 騒音解析のブラウザ内実装（サーバー版 F-07/Step 4 の簡易移植） ──

const WINDOW_SEC = 300;
const RECENT_SEC = 5;
const AUTO_SUSTAIN_SEC = 30;
const AUTO_COOLDOWN_SEC = 300;

const metricBuf: { t: number; rms: number }[] = [];
let loudSince: number | null = null;
let lastAuto = 0;

function category(level: number): NoiseCategory {
  if (level < 0.02) return 'quiet';
  if (level < 0.08) return 'normal';
  if (level < 0.16) return 'loud';
  return 'very_loud';
}

export function ingestLocalMetric(rms: number): TbAnalysis {
  const now = Date.now() / 1000;
  metricBuf.push({ t: now, rms });
  while (metricBuf.length && metricBuf[0].t < now - WINDOW_SEC) metricBuf.shift();

  const rmsSorted = metricBuf.map((m) => m.rms).sort((a, b) => a - b);
  const noiseFloor = rmsSorted[Math.min(rmsSorted.length - 1, Math.floor(rmsSorted.length * 0.1))] ?? 0;
  const threshold = Math.max(noiseFloor * 1.8, 0.01);

  const recent = metricBuf.filter((m) => m.t >= now - RECENT_SEC);
  const level = recent.length ? recent.reduce((s, m) => s + m.rms, 0) / recent.length : 0;

  const density = (win: number) => {
    const frames = metricBuf.filter((m) => m.t >= now - win);
    if (!frames.length) return 0;
    return frames.filter((m) => m.rms > threshold).length / frames.length;
  };

  const cat = category(level);
  const noisePenalty = { quiet: 0, normal: 5, loud: 35, very_loud: 55 }[cat];
  const d1 = density(60);
  const silencePenalty = metricBuf.length > 60 && d1 < 0.05 ? 10 : 0;

  // サーバー版と同じ自動 too_loud アラート（クールダウン付き）
  if (cat === 'loud' || cat === 'very_loud') {
    if (loudSince === null) loudSince = now;
    else if (now - loudSince >= AUTO_SUSTAIN_SEC && now - lastAuto >= AUTO_COOLDOWN_SEC) {
      try { postAlert('too_loud', 'auto'); lastAuto = now; } catch { /* セッションなしは無視 */ }
    }
  } else {
    loudSince = null;
  }

  return {
    active: load().session !== null,
    samples: metricBuf.length,
    noiseLevel: level,
    noiseDb: Math.round(200 * Math.log10(Math.max(level, 1e-5))) / 10,
    noiseCategory: cat,
    noiseFloor,
    speechDensity1m: d1,
    speechDensity5m: density(300),
    comfortScore: Math.max(0, Math.min(100, 100 - noisePenalty - silencePenalty)),
  };
}
