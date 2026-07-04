// TalkBalancer API client (docs/talkbalancer/REQUIREMENTS_v0.2.md — Step 1)
//
// バックエンド（FastAPI）に接続できない環境（GitHub Pages 等の静的ホスティング）
// では、自動的にデモモードへフォールバックし、localStorage で同一ブラウザ内
// 動作する（./talkbalancer-demo.ts）。
import { API_BASE_URL } from './api';
import * as demo from './talkbalancer-demo';

export type SessionMode = 'volume_only' | 'balance' | 'transcript';

export type AlertType =
  | 'talk_too_much'
  | 'too_loud'
  | 'same_story'
  | 'preaching'
  | 'sensitive_topic'
  | 'pass_around'
  | 'topic_shift'
  | 'drink_water'
  | 'take_break';

export interface TbSession {
  id: string;
  title: string;
  startedAt: string;
  mode: SessionMode;
  savePolicy: 'none';
  agreedAt?: string | null;
}

export interface TbAlert {
  seq: number;
  sessionId: string;
  timestamp: string;
  type: AlertType;
  source: 'manual' | 'auto';
  message: string;
  severity: 'info' | 'notice' | 'strong';
}

export interface SessionState {
  active: boolean;
  session: TbSession | null;
  seq: number;
}

// F-07 / Step 4: サーバー解析結果
export type NoiseCategory = 'quiet' | 'normal' | 'loud' | 'very_loud';

export interface TbAnalysis {
  active: boolean;
  samples: number;
  noiseLevel: number;       // 0..1 直近5秒平均RMS
  noiseDb: number;          // dBFS相当
  noiseCategory: NoiseCategory;
  noiseFloor: number;
  speechDensity1m: number;  // 0..1 直近1分の会話密度
  speechDensity5m: number;
  comfortScore: number;     // 0..100 会話しやすさ
  seq?: number;
}

export interface TbReport {
  active: boolean;
  session: TbSession | null;
  durationSec?: number;
  totalAlerts?: number;
  manualAlerts?: number;
  autoAlerts?: number;
  alertCounts?: Record<AlertType, number>;
  latestAlerts?: TbAlert[];
  analysis?: TbAnalysis;
  privacy?: {
    recording: boolean;
    transcription: boolean;
    cloudUpload: boolean;
    savePolicy: 'none';
  };
}

export const NOISE_LABELS: Record<NoiseCategory, string> = {
  quiet: '低め',
  normal: '普通',
  loud: '高め',
  very_loud: 'かなり高め',
};

// 解析モードの表示ラベル（全画面共通。各ページの局所 MODE_LABELS とは別に共有表示で使う）
export const TB_MODE_LABELS: Record<SessionMode, string> = {
  volume_only: 'モードA：音量のみ',
  balance: 'モードB：音量＋発話バランス',
  transcript: 'モードC：文字起こしあり',
};

export interface TbPrivacy {
  recording: boolean;
  transcription: boolean;
  cloudUpload: boolean;
}

// 解析モードからプライバシー状態を導出する（10.1 常時表示用）。
// backend の _privacy_for_mode と同一マッピングにすること：
// transcript のみ録音・文字起こしが ON、それ以外（null/未開始 含む）は全 OFF。
// クラウド送信はローカル処理前提のため常に false。
export function derivePrivacy(mode: SessionMode | null | undefined): TbPrivacy {
  const isTranscript = mode === 'transcript';
  return {
    recording: isTranscript,
    transcription: isTranscript,
    cloudUpload: false,
  };
}

const TB = `${API_BASE_URL}/talkbalancer`;

// ── デモモード判定 ──
// ネットワークエラー、または API パスが 404（静的ホスティング）の場合に
// デモモードへ切り替える。一度切り替わったらページ再読み込みまで維持する。
let demoMode = false;

export function isDemoMode(): boolean {
  return demoMode;
}

async function tbFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (demoMode) return null;
  try {
    const res = await fetch(`${TB}${path}`, init);
    if (res.status === 404) {
      demoMode = true;
      return null;
    }
    return res;
  } catch {
    demoMode = true;
    return null;
  }
}

export async function fetchTbSession(): Promise<SessionState> {
  const res = await tbFetch('/session', { cache: 'no-store' });
  if (!res) return demo.getSession();
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export async function startTbSession(
  title: string,
  mode: SessionMode,
  agreedAt?: string | null,
): Promise<SessionState> {
  const res = await tbFetch('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, mode, agreedAt: agreedAt ?? null }),
  });
  if (!res) return demo.startSession(title, mode, agreedAt ?? null);
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function endTbSession(): Promise<void> {
  // 会が終わったら合意フラグも消す（次の会で改めて宣言→合意させる。F-01）
  clearTbAgreedAt();
  const res = await tbFetch('/session', { method: 'DELETE' });
  if (!res) return demo.endSession();
  if (!res.ok) throw new Error('Failed to end session');
}

export async function sendTbAlert(type: AlertType): Promise<TbAlert> {
  const res = await tbFetch('/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!res) return demo.postAlert(type);
  if (!res.ok) throw new Error('Failed to send alert');
  return res.json();
}

export async function fetchTbAlerts(after: number): Promise<{ alerts: TbAlert[]; seq: number; active: boolean }> {
  const res = await tbFetch(`/alerts?after=${after}`, { cache: 'no-store' });
  if (!res) return demo.listAlerts(after);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchTbAnalysis(): Promise<TbAnalysis> {
  const res = await tbFetch('/analysis', { cache: 'no-store' });
  if (!res) return demo.ingestLocalMetric(0);
  if (!res.ok) throw new Error('Failed to fetch analysis');
  return res.json();
}

export async function fetchTbReport(): Promise<TbReport> {
  const res = await tbFetch('/report', { cache: 'no-store' });
  if (!res) return demo.getReport();
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

// デモモード時にテーブル端末内で解析する（音声波形は端末から出ない）
export function ingestDemoMetric(rms: number): TbAnalysis {
  return demo.ingestLocalMetric(rms);
}

// Step 3: 音声メトリクス送信用 WebSocket の URL（音声波形は送らない）
export function tbMetricsWsUrl(): string {
  if (API_BASE_URL.startsWith('http')) {
    return `${API_BASE_URL.replace(/^http/, 'ws')}/talkbalancer/ws/metrics`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${API_BASE_URL}/talkbalancer/ws/metrics`;
}

// F-05 幹事リモコンのボタン定義
export const REMOTE_BUTTONS: { type: AlertType; label: string; emoji: string }[] = [
  { type: 'talk_too_much', label: '話しすぎ', emoji: '🗣️' },
  { type: 'too_loud', label: 'うるさすぎ', emoji: '🔊' },
  { type: 'same_story', label: '同じ話', emoji: '🔁' },
  { type: 'preaching', label: '説教っぽい', emoji: '📢' },
  { type: 'sensitive_topic', label: 'センシティブ話題', emoji: '⚠️' },
  { type: 'pass_around', label: '他の人にも振る', emoji: '🎤' },
  { type: 'topic_shift', label: '話題転換', emoji: '💡' },
  { type: 'drink_water', label: '水を飲む', emoji: '💧' },
  { type: 'take_break', label: '休憩', emoji: '☕' },
];

// F-01 開始前宣言
export const DECLARATION_LINES = [
  '一人が話しすぎない',
  '他の人にも話を振る',
  '容姿、年齢、結婚、子ども、恋愛、家庭事情を不用意にいじらない',
  '説教や武勇伝が長くなりすぎたら一度止める',
  '店内がうるさすぎる場合は、無理に全体会話を続けない',
  'TalkBalancerの表示は、個人攻撃ではなく場を整える合図とします',
];

// F-01 合意ゲート用
const AGREED_KEY = 'tb_agreed_at_v1';
// F-03 マイク選択の端末ローカル保持(deviceIdはブラウザローカルなのでサーバーSessionには載せない)
const MIC_DEVICE_KEY = 'tb_mic_device_v1';

export interface TbMicDevice {
  deviceId: string;
  label: string;
  isExternal: boolean;
}

// F-01 合意ゲート用
export function setTbAgreedAt(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AGREED_KEY, iso);
  } catch { /* プライベートモード等で保存不可でも動作は継続 */ }
}

// F-01 合意ゲート用
export function getTbAgreedAt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(AGREED_KEY);
  } catch { return null; }
}

// F-01 合意ゲート用。セッション終了時に消し、次の会では改めて宣言→合意させる。
export function clearTbAgreedAt(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AGREED_KEY);
  } catch { /* プライベートモード等で削除不可でも動作は継続 */ }
}

// F-03 マイク選択の端末ローカル保持(deviceIdはブラウザローカルなのでサーバーSessionには載せない)
export function saveTbMicDevice(d: TbMicDevice): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(MIC_DEVICE_KEY, JSON.stringify(d));
  } catch { /* プライベートモード等で保存不可でも動作は継続 */ }
}

// F-03 マイク選択の端末ローカル保持(deviceIdはブラウザローカルなのでサーバーSessionには載せない)
export function loadTbMicDevice(): TbMicDevice | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(MIC_DEVICE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TbMicDevice;
  } catch { return null; }
}

// F-03 マイク選択の端末ローカル保持(deviceIdはブラウザローカルなのでサーバーSessionには載せない)
export function clearTbMicDevice(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(MIC_DEVICE_KEY);
  } catch { /* プライベートモード等で保存不可でも動作は継続 */ }
}
