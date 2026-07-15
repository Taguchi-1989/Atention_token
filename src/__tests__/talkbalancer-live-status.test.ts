import type { TbSpeakerStats } from '@/lib/talkbalancer';
import {
  clearTalkBalancerRuntime,
  publishTalkBalancerRuntime,
  readTalkBalancerRuntime,
  summarizeSpeakerBalance,
} from '@/lib/talkbalancer-live-status';

function stats(shares: number[]): TbSpeakerStats {
  const participants = shares.map((_, index) => ({
    id: `speaker_${index + 1}`,
    name: `${String.fromCharCode(65 + index)}さん`,
    color: '#00f2ff',
  }));
  const total = shares.map((share, index) => ({
    participantId: participants[index].id,
    name: participants[index].name,
    color: participants[index].color,
    seconds: Math.round(share * 100),
    share,
  }));
  return {
    active: true,
    participants,
    total,
    recent5m: total,
    totalSeconds: total.reduce((sum, person) => sum + person.seconds, 0),
    recent5mSeconds: total.reduce((sum, person) => sum + person.seconds, 0),
    latestEvent: null,
  };
}

describe('TalkBalancer live status', () => {
  beforeEach(() => window.localStorage.clear());

  test('publishes, expires, and clears the microphone runtime lease', () => {
    publishTalkBalancerRuntime('source-a', '内蔵マイク');
    const active = readTalkBalancerRuntime();
    expect(active).toMatchObject({ measuring: true, sourceId: 'source-a', micLabel: '内蔵マイク', sourcePath: '/' });

    expect(readTalkBalancerRuntime((active?.updatedAt ?? 0) + 7_000)?.measuring).toBe(false);

    clearTalkBalancerRuntime('another-source');
    expect(readTalkBalancerRuntime()?.measuring).toBe(true);
    clearTalkBalancerRuntime('source-a');
    expect(readTalkBalancerRuntime()?.measuring).toBe(false);
  });

  test('does not judge a single recorded speaker as talking too much', () => {
    const summary = summarizeSpeakerBalance(stats([1, 0, 0]));
    expect(summary.state).toBe('single');
    expect(summary.headline).toContain('1人');
    expect(summary.guidance).toContain('偏りを判断しません');
  });

  test('gives gentle guidance when one recorded share reaches 55 percent', () => {
    const summary = summarizeSpeakerBalance(stats([0.6, 0.25, 0.15]));
    expect(summary.state).toBe('attention');
    expect(summary.headline).toContain('60%');
    expect(summary.guidance).toContain('ほかの人にも話を振る');
  });
});
