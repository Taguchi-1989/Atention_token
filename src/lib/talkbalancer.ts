// TalkBalancer API client (docs/talkbalancer/REQUIREMENTS_v0.2.md — Step 1)
import { API_BASE_URL } from './api';

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

const TB = `${API_BASE_URL}/talkbalancer`;

export async function fetchTbSession(): Promise<SessionState> {
  const res = await fetch(`${TB}/session`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

export async function startTbSession(title: string, mode: SessionMode): Promise<SessionState> {
  const res = await fetch(`${TB}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, mode }),
  });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function endTbSession(): Promise<void> {
  const res = await fetch(`${TB}/session`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to end session');
}

export async function sendTbAlert(type: AlertType): Promise<TbAlert> {
  const res = await fetch(`${TB}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error('Failed to send alert');
  return res.json();
}

export async function fetchTbAlerts(after: number): Promise<{ alerts: TbAlert[]; seq: number; active: boolean }> {
  const res = await fetch(`${TB}/alerts?after=${after}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
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
