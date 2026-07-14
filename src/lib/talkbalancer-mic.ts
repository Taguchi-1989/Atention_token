export type TalkBalancerMicPreference = {
  deviceId: string;
  label: string;
  isExternal: boolean;
};

const MIC_PREFERENCE_KEY = 'talkbalancer.micPreference.v1';

export function classifyExternalMic(label: string): boolean {
  const normalized = label.toLowerCase();
  return /usb|外部|external|speakerphone|jabra|anker|powerconf|shure|r[oø]de|audio-technica|sennheiser/.test(normalized);
}

export function rmsToDbfs(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return -100;
  return Math.max(-100, Math.min(0, 20 * Math.log10(rms)));
}

// TalkBalancer の「かなり高め」境界（RMS 0.25前後）を100として扱う相対表示。
// 端末・マイク・OSの自動ゲインで変わるため、物理的な騒音dBではない。
export function rmsToRelativeLevel(rms: number): number {
  if (!Number.isFinite(rms)) return 0;
  return Math.max(0, Math.min(100, Math.round((rms / 0.25) * 100)));
}

export function saveMicPreference(preference: TalkBalancerMicPreference): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MIC_PREFERENCE_KEY, JSON.stringify(preference));
}

export function loadMicPreference(): TalkBalancerMicPreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MIC_PREFERENCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TalkBalancerMicPreference>;
    if (typeof parsed.deviceId !== 'string' || typeof parsed.label !== 'string' || typeof parsed.isExternal !== 'boolean') {
      return null;
    }
    return {
      deviceId: parsed.deviceId,
      label: parsed.label,
      isExternal: parsed.isExternal,
    };
  } catch {
    return null;
  }
}
