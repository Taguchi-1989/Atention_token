import { analyzeTranscriptNotes } from '@/lib/talkbalancer-transcript';
import type { TbTranscriptNote } from '@/lib/talkbalancer';

function note(text: string, source: 'auto' | 'manual' = 'auto', participantId: string | null = 'speaker_1'): TbTranscriptNote {
  return {
    id: `${source}-${text}`,
    sessionId: 'session-1',
    timestamp: '2026-07-17T00:00:00Z',
    text,
    participantId,
    participantName: participantId ? 'Aさん' : null,
    source,
  };
}

describe('TalkBalancer transcript analysis', () => {
  test('summarizes live transcript segments without external services', () => {
    const result = analyzeTranscriptNotes([
      note('二次会の場所を相談します。新宿の場所が便利です。'),
      note('二次会は新宿にしましょう。'),
      note('駅から近い店に訂正', 'manual', null),
    ]);

    expect(result.segmentCount).toBe(3);
    expect(result.autoSegmentCount).toBe(2);
    expect(result.manualNoteCount).toBe(1);
    expect(result.speakerCount).toBe(1);
    expect(result.characterCount).toBeGreaterThan(20);
    expect(result.topKeywords.some((item) => item.term.includes('二次会'))).toBe(true);
    expect(result.recentTopic).toContain('駅から近い店');
  });

  test('returns an empty analysis before speech arrives', () => {
    expect(analyzeTranscriptNotes([])).toEqual({
      segmentCount: 0,
      autoSegmentCount: 0,
      manualNoteCount: 0,
      characterCount: 0,
      speakerCount: 0,
      topKeywords: [],
      recentTopic: '',
    });
  });
});
