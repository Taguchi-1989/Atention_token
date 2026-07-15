// TalkBalancer デモモード（バックエンド未接続時のフォールバック）
//
// GitHub Pages などの静的ホスティングでは FastAPI が存在しないため、
// セッション・アラートを localStorage に保存して同一ブラウザ内で完結させる。
// テーブル表示と幹事リモコンを別タブで開けば、ポーリング経由で連携デモができる。
// 騒音解析はサーバー実装（python/attention_ledger/api/talkbalancer.py）の
// 簡易移植をブラウザ内で行う。データは端末外に一切送信されない。

import type {
  TbSession, TbAlert, TbAnalysis, TbReport, SessionState, SessionMode, AlertType, NoiseCategory,
  TbParticipant, TbSpeakerEvent, TbSpeakerStats, TbTranscriptNote,
} from './talkbalancer';

const KEY = 'talkbalancer_demo_v1';

// backend IMPLEMENTED_MODES と同じ多層防御。
const DEMO_IMPLEMENTED_MODES: SessionMode[] = ['volume_only', 'balance', 'transcript'];

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
const PARTICIPANT_COLORS = [
  '#00f2ff', '#00ff88', '#ffaa00', '#ff4466', '#7000ff',
  '#38bdf8', '#f472b6', '#a3e635', '#fb7185', '#c084fc',
];

interface DemoState {
  session: TbSession | null;
  seq: number;
  alerts: TbAlert[];
  participants: TbParticipant[];
  speakerEvents: TbSpeakerEvent[];
  transcriptNotes: TbTranscriptNote[];
}

function emptyState(): DemoState {
  return { session: null, seq: 0, alerts: [], participants: [], speakerEvents: [], transcriptNotes: [] };
}

function load(): DemoState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch { /* 壊れたデータは初期化 */ }
  return emptyState();
}

function save(state: DemoState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* プライベートモード等で保存不可でも動作は継続 */ }
}

export function getSession(): SessionState {
  const s = load();
  return { active: s.session !== null, session: s.session, seq: s.seq, participants: s.participants };
}

function makeParticipants(names?: string[]): TbParticipant[] {
  let clean = (names ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (clean.length === 0) {
    const count = names && names.length > 0 ? Math.min(names.length, 20) : 4;
    clean = Array.from({ length: count }, (_, i) => `${String.fromCharCode(65 + i)}さん`);
  }
  return clean.map((name, i) => ({
    id: `speaker_${i + 1}`,
    name: name.slice(0, 30),
    color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
  }));
}

export function startSession(
  title: string,
  mode: SessionMode,
  participantNames?: string[],
  agreedAt: string | null = null,
): SessionState {
  if (title.length > 100) throw new Error('会の名前は100文字以内で入力してください');
  if (!DEMO_IMPLEMENTED_MODES.includes(mode)) {
    throw new Error(`解析モード '${mode}' は未実装です`);
  }
  const participants = makeParticipants(participantNames);
  const state: DemoState = {
    session: {
      id: Math.random().toString(36).slice(2, 14),
      title,
      startedAt: new Date().toISOString(),
      mode,
      savePolicy: 'none',
      agreedAt,
    },
    seq: 0,
    alerts: [],
    participants,
    speakerEvents: [],
    transcriptNotes: [],
  };
  resetLocalMetrics(); // サーバー start_session の _reset_metrics_locked() に対応
  save(state);
  return { active: true, session: state.session, seq: 0, participants };
}

export function endSession(): void {
  resetLocalMetrics();
  save(emptyState());
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
  s.alerts = [...s.alerts, alert].slice(-50);
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

// サーバー _reset_metrics_locked と同範囲(計測バッファ／騒音継続判定／自動アラートのクールダウン)
function resetLocalMetrics(): void {
  metricBuf.length = 0;   // const配列なので length=0 で中身を消す(再代入不可)
  loudSince = null;
  lastAuto = 0;
}

function category(level: number): NoiseCategory {
  if (level < 0.02) return 'quiet';
  if (level < 0.08) return 'normal';
  if (level < 0.16) return 'loud';
  return 'very_loud';
}

function computeAnalysis(now: number): TbAnalysis {
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

  return {
    active: load().session !== null,
    samples: metricBuf.length,
    noiseLevel: Math.round(level * 10000) / 10000,
    noiseDb: Math.round(200 * Math.log10(Math.max(level, 1e-5))) / 10,
    noiseCategory: cat,
    noiseFloor: Math.round(noiseFloor * 10000) / 10000,
    speechDensity1m: Math.round(d1 * 1000) / 1000,
    speechDensity5m: Math.round(density(300) * 1000) / 1000,
    comfortScore: Math.max(0, Math.min(100, 100 - noisePenalty - silencePenalty)),
  };
}

export function getParticipants(): { active: boolean; participants: TbParticipant[] } {
  const s = load();
  return { active: s.session !== null, participants: s.participants };
}

export function updateParticipants(names: string[]): { active: boolean; participants: TbParticipant[] } {
  const s = load();
  if (!s.session) throw new Error('セッションが開始されていません');
  s.participants = makeParticipants(names);
  save(s);
  return { active: true, participants: s.participants };
}

function computeSpeakerStats(state: DemoState, nowMs: number = Date.now()): TbSpeakerStats {
  const totals = new Map(state.participants.map((p) => [p.id, 0]));
  const recent = new Map(state.participants.map((p) => [p.id, 0]));
  let latestEvent: TbSpeakerEvent | null = null;

  for (const event of state.speakerEvents) {
    if (!totals.has(event.participantId)) continue;
    totals.set(event.participantId, (totals.get(event.participantId) ?? 0) + event.durationSec);
    if (new Date(event.timestamp).getTime() >= nowMs - 300000) {
      recent.set(event.participantId, (recent.get(event.participantId) ?? 0) + event.durationSec);
    }
    if (!latestEvent || event.timestamp > latestEvent.timestamp) latestEvent = event;
  }

  const totalSeconds = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const recent5mSeconds = Array.from(recent.values()).reduce((a, b) => a + b, 0);
  const rows = (bucket: Map<string, number>, denom: number) => state.participants.map((p) => {
    const seconds = bucket.get(p.id) ?? 0;
    return {
      participantId: p.id,
      name: p.name,
      color: p.color,
      seconds,
      share: denom ? Math.round((seconds / denom) * 10000) / 10000 : 0,
    };
  });

  return {
    active: state.session !== null,
    participants: state.participants,
    total: rows(totals, totalSeconds),
    recent5m: rows(recent, recent5mSeconds),
    totalSeconds,
    recent5mSeconds,
    latestEvent,
  };
}

export function getSpeakerStats(): TbSpeakerStats {
  return computeSpeakerStats(load());
}

export function recordSpeakerEvent(participantId: string, durationSec: number = 15): { event: TbSpeakerEvent; stats: TbSpeakerStats } {
  const s = load();
  if (!s.session) throw new Error('セッションが開始されていません');
  if (!s.participants.some((p) => p.id === participantId)) throw new Error('参加者が見つかりません');
  if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 300) {
    throw new Error('発話時間は1〜300秒で指定してください');
  }
  const event: TbSpeakerEvent = {
    id: Math.random().toString(36).slice(2, 14),
    sessionId: s.session.id,
    participantId,
    timestamp: new Date().toISOString(),
    durationSec,
    source: 'manual',
  };
  s.speakerEvents = [...s.speakerEvents, event].slice(-5000);
  save(s);
  return { event, stats: computeSpeakerStats(s) };
}

export function recordSpeakerBatch(events: { participantId: string; durationSec: number }[]): { events: TbSpeakerEvent[]; stats: TbSpeakerStats } {
  const recorded = events.map((event) => recordSpeakerEvent(event.participantId, event.durationSec).event);
  return { events: recorded, stats: getSpeakerStats() };
}

export function getTranscriptNotes(): { active: boolean; enabled: boolean; notes: TbTranscriptNote[] } {
  const s = load();
  return {
    active: s.session !== null,
    enabled: s.session?.mode === 'transcript',
    notes: s.transcriptNotes,
  };
}

export function createTranscriptNote(
  text: string,
  participantId?: string,
): { note: TbTranscriptNote; notes: TbTranscriptNote[] } {
  const s = load();
  if (!s.session) throw new Error('セッションが開始されていません');
  if (s.session.mode !== 'transcript') throw new Error('文字起こしメモはモードCでのみ使えます');
  const participant = s.participants.find((p) => p.id === participantId);
  if (participantId && !participant) throw new Error('参加者が見つかりません');
  const cleanText = text.trim();
  if (!cleanText) throw new Error('メモ本文が空です');
  if (text.length > 500) throw new Error('メモ本文は500文字以内で入力してください');
  const note: TbTranscriptNote = {
    id: Math.random().toString(36).slice(2, 14),
    sessionId: s.session.id,
    timestamp: new Date().toISOString(),
    text: cleanText,
    participantId: participant?.id ?? null,
    participantName: participant?.name ?? null,
    source: 'manual',
  };
  s.transcriptNotes = [...s.transcriptNotes, note].slice(-200);
  save(s);
  return { note, notes: s.transcriptNotes };
}

export function ingestLocalMetric(rms: number): TbAnalysis {
  if (!load().session) throw new Error('セッションが開始されていません');
  if (!Number.isFinite(rms) || rms < 0 || rms > 1) {
    throw new Error('RMSは0〜1で指定してください');
  }
  const now = Date.now() / 1000;
  metricBuf.push({ t: now, rms });
  const analysis = computeAnalysis(now);

  // サーバー版と同じく、メトリクス取り込み時だけ自動アラートを評価する。
  if (analysis.noiseCategory === 'loud' || analysis.noiseCategory === 'very_loud') {
    if (loudSince === null) loudSince = now;
    else if (now - loudSince >= AUTO_SUSTAIN_SEC && now - lastAuto >= AUTO_COOLDOWN_SEC) {
      postAlert('too_loud', 'auto');
      lastAuto = now;
    }
  } else {
    loudSince = null;
  }
  analysis.seq = load().seq;
  return analysis;
}

export function getAnalysis(): TbAnalysis {
  const analysis = computeAnalysis(Date.now() / 1000);
  analysis.seq = load().seq;
  return analysis;
}

export function getReport(): TbReport {
  const s = load();
  if (!s.session) return { active: false, session: null };

  const counts = Object.keys(MESSAGES).reduce((acc, type) => {
    acc[type as AlertType] = 0;
    return acc;
  }, {} as Record<AlertType, number>);
  let manual = 0;
  let auto = 0;
  for (const alert of s.alerts) {
    counts[alert.type] += 1;
    if (alert.source === 'auto') auto += 1;
    else manual += 1;
  }

  return {
    active: true,
    session: s.session,
    durationSec: Math.max(0, Math.floor(Date.now() / 1000 - new Date(s.session.startedAt).getTime() / 1000)),
    totalAlerts: s.alerts.length,
    manualAlerts: manual,
    autoAlerts: auto,
    alertCounts: counts,
    latestAlerts: s.alerts.slice(-5),
    analysis: computeAnalysis(Date.now() / 1000),
    speakerStats: computeSpeakerStats(s),
    transcriptNotes: s.transcriptNotes.slice(-20),
    privacy: {
      recording: false,
      transcription: s.session.mode === 'transcript',
      localAudioProcessing: false,
      cloudUpload: false,
      savePolicy: 'none',
    },
  };
}
