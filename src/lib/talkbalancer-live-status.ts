import type { TbSpeakerStats } from './talkbalancer';

const RUNTIME_KEY = 'talkbalancer.runtime.mic.v1';
export const TALK_BALANCER_RUNTIME_EVENT = 'talkbalancer-runtime-change';
const RUNTIME_STALE_MS = 6_000;

export interface TalkBalancerRuntimeState {
  measuring: boolean;
  sourceId: string;
  micLabel: string | null;
  sourcePath: string | null;
  updatedAt: number;
}

export function createTalkBalancerRuntimeSourceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseRuntime(raw: string | null): TalkBalancerRuntimeState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TalkBalancerRuntimeState>;
    if (
      typeof value.measuring !== 'boolean'
      || typeof value.sourceId !== 'string'
      || typeof value.updatedAt !== 'number'
    ) return null;
    return {
      measuring: value.measuring,
      sourceId: value.sourceId,
      micLabel: typeof value.micLabel === 'string' ? value.micLabel : null,
      sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath : null,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readTalkBalancerRuntime(now: number = Date.now()): TalkBalancerRuntimeState | null {
  if (typeof window === 'undefined') return null;
  let state: TalkBalancerRuntimeState | null = null;
  try {
    state = parseRuntime(window.localStorage.getItem(RUNTIME_KEY));
  } catch {
    return null;
  }
  if (!state) return null;
  if (state.measuring && now - state.updatedAt > RUNTIME_STALE_MS) {
    return { ...state, measuring: false };
  }
  return state;
}

function emitRuntimeChange(state: TalkBalancerRuntimeState | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TALK_BALANCER_RUNTIME_EVENT, { detail: state }));
}

export function publishTalkBalancerRuntime(sourceId: string, micLabel: string | null): void {
  if (typeof window === 'undefined') return;
  const state: TalkBalancerRuntimeState = {
    measuring: true,
    sourceId,
    micLabel,
    sourcePath: window.location.pathname,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(RUNTIME_KEY, JSON.stringify(state));
  } catch {
    // localStorage が使えない場合も同一画面にはイベントで状態を通知する。
  }
  emitRuntimeChange(state);
}

export function clearTalkBalancerRuntime(sourceId: string): void {
  if (typeof window === 'undefined') return;
  let current: TalkBalancerRuntimeState | null = null;
  try {
    current = parseRuntime(window.localStorage.getItem(RUNTIME_KEY));
  } catch {
    // 読み出せない場合も同一画面には停止イベントを送る。
  }
  if (current && current.sourceId !== sourceId) return;
  const state: TalkBalancerRuntimeState = {
    measuring: false,
    sourceId,
    micLabel: current?.micLabel ?? null,
    sourcePath: current?.sourcePath ?? window.location.pathname,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(RUNTIME_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても同一画面の表示は更新する。
  }
  emitRuntimeChange(state);
}

export interface SpeakerBalanceSummary {
  headline: string;
  guidance: string;
  participantId: string | null;
  share: number | null;
  state: 'empty' | 'single' | 'balanced' | 'attention';
}

export function summarizeSpeakerBalance(stats: TbSpeakerStats | null): SpeakerBalanceSummary {
  if (!stats || stats.totalSeconds <= 0) {
    return {
      headline: '発話記録はまだありません',
      guidance: '幹事が話者をタップすると割合を表示します。',
      participantId: null,
      share: null,
      state: 'empty',
    };
  }

  const recorded = stats.total.filter((person) => person.seconds > 0);
  const leader = [...stats.total].sort((a, b) => b.seconds - a.seconds)[0];
  const percent = Math.round((leader?.share ?? 0) * 100);

  if (recorded.length === 1) {
    return {
      headline: `1人分のみ：${leader.name} ${percent}%`,
      guidance: '1人分だけでは偏りを判断しません。ほかの人が話したら、その人もタップしてください。',
      participantId: leader.participantId,
      share: percent,
      state: 'single',
    };
  }

  if (percent >= 55) {
    return {
      headline: `${leader.name} ${percent}%`,
      guidance: '少し発話が集まっています。一度ほかの人にも話を振ると、場が広がりそうです。',
      participantId: leader.participantId,
      share: percent,
      state: 'attention',
    };
  }

  return {
    headline: `最多 ${leader.name} ${percent}%`,
    guidance: '現在のタップ記録では、おおむねバランスよく進んでいます。',
    participantId: leader.participantId,
    share: percent,
    state: 'balanced',
  };
}
