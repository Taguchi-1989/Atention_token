import {
  classifyExternalMic,
  loadMicPreference,
  rmsToDbfs,
  rmsToRelativeLevel,
  saveMicPreference,
} from '@/lib/talkbalancer-mic';

describe('TalkBalancer mic helpers', () => {
  test('classifies common external microphone labels', () => {
    expect(classifyExternalMic('Jabra Speak2 55')).toBe(true);
    expect(classifyExternalMic('USB Audio Device')).toBe(true);
    expect(classifyExternalMic('Microphone Array (Realtek Audio)')).toBe(false);
  });

  test('converts RMS to a bounded dBFS reference value', () => {
    expect(rmsToDbfs(1)).toBe(0);
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20, 5);
    expect(rmsToDbfs(0)).toBe(-100);
  });

  test('converts RMS to the relative 0-100 display scale', () => {
    expect(rmsToRelativeLevel(0)).toBe(0);
    expect(rmsToRelativeLevel(0.125)).toBe(50);
    expect(rmsToRelativeLevel(0.25)).toBe(100);
    expect(rmsToRelativeLevel(1)).toBe(100);
  });

  test('persists the selected built-in microphone for the table display', () => {
    window.localStorage.clear();
    saveMicPreference({
      deviceId: 'built-in-1',
      label: 'Microphone Array (Realtek Audio)',
      isExternal: false,
    });

    expect(loadMicPreference()).toEqual({
      deviceId: 'built-in-1',
      label: 'Microphone Array (Realtek Audio)',
      isExternal: false,
    });
  });
});
