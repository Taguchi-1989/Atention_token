import {
  createTranscriptNote,
  endSession,
  getAnalysis,
  getReport,
  getSession,
  getSpeakerStats,
  getTranscriptNotes,
  ingestLocalMetric,
  listAlerts,
  postAlert,
  recordSpeakerEvent,
  startSession,
  updateParticipants,
} from '@/lib/talkbalancer-demo';

describe('TalkBalancer demo mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    endSession();
  });

  it('starts with normalized participants and exposes the current session', () => {
    const started = startSession('懇親会', 'balance', [' Alice ', '', 'B'.repeat(40)]);

    expect(started.active).toBe(true);
    expect(started.participants?.map((participant) => participant.name)).toEqual([
      'Alice',
      'B'.repeat(30),
    ]);
    expect(getSession()).toEqual(started);
  });

  it('uses default participants when supplied names are blank', () => {
    const started = startSession('飲み会', 'volume_only', [' ', '']);

    expect(started.participants?.map((participant) => participant.name)).toEqual(['Aさん', 'Bさん']);
  });

  it('applies the same session title and alert retention limits as the API', () => {
    expect(() => startSession('x'.repeat(101), 'volume_only')).toThrow('100文字以内');
    startSession('飲み会', 'volume_only');
    for (let i = 0; i < 55; i += 1) postAlert('topic_shift');

    const alerts = listAlerts(0);
    expect(alerts.alerts).toHaveLength(50);
    expect(alerts.seq).toBe(55);
    expect(alerts.alerts[0].seq).toBe(6);
  });

  it('keeps speaker history when participant labels are updated', () => {
    startSession('飲み会', 'balance', ['Aさん', 'Bさん']);
    recordSpeakerEvent('speaker_1', 30);

    updateParticipants(['田中', '佐藤']);
    const stats = getSpeakerStats();

    expect(stats.totalSeconds).toBe(30);
    expect(stats.total[0]).toMatchObject({ name: '田中', seconds: 30, share: 1 });
  });

  it('validates speaker duration like the API', () => {
    startSession('飲み会', 'balance', ['Aさん']);

    expect(() => recordSpeakerEvent('speaker_1', 0)).toThrow('1〜300秒');
    expect(() => recordSpeakerEvent('speaker_1', 301)).toThrow('1〜300秒');
    expect(() => recordSpeakerEvent('missing', 15)).toThrow('参加者が見つかりません');
  });

  it('reads analysis without adding a sample and validates metric ingestion', () => {
    expect(getAnalysis()).toMatchObject({ active: false, samples: 0, seq: 0 });
    expect(() => ingestLocalMetric(0.1)).toThrow('セッションが開始されていません');

    startSession('飲み会', 'volume_only', ['Aさん']);
    expect(() => ingestLocalMetric(-0.1)).toThrow('RMSは0〜1');
    expect(() => ingestLocalMetric(1.1)).toThrow('RMSは0〜1');
    expect(ingestLocalMetric(0.1)).toMatchObject({ active: true, samples: 1, seq: 0 });
    expect(getAnalysis()).toMatchObject({ active: true, samples: 1, seq: 0 });
  });

  it('allows notes only in transcript mode and rejects blank notes', () => {
    startSession('飲み会', 'balance', ['Aさん']);
    expect(() => createTranscriptNote('メモ')).toThrow('モードC');

    startSession('飲み会', 'transcript', ['Aさん']);
    expect(() => createTranscriptNote('   ')).toThrow('メモ本文が空です');
    const result = createTranscriptNote('  要点  ', 'speaker_1');

    expect(result.note).toMatchObject({ text: '要点', participantName: 'Aさん' });
    expect(getTranscriptNotes()).toMatchObject({ active: true, enabled: true });
  });

  it('deletes alerts, speaker data, notes, and metrics when the session ends', () => {
    startSession('飲み会', 'transcript', ['Aさん']);
    postAlert('too_loud');
    recordSpeakerEvent('speaker_1', 15);
    createTranscriptNote('要点', 'speaker_1');
    ingestLocalMetric(0.2);

    endSession();
    const report = getReport();

    expect(report).toEqual({ active: false, session: null });
    expect(listAlerts(0)).toEqual({ alerts: [], seq: 0, active: false });
    expect(getSpeakerStats()).toMatchObject({ active: false, totalSeconds: 0 });
    expect(getTranscriptNotes()).toEqual({ active: false, enabled: false, notes: [] });

    startSession('次の会', 'volume_only', ['Aさん']);
    expect(getReport().analysis?.samples).toBe(0);
  });
});
