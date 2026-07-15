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
import * as demo from '@/lib/talkbalancer-demo';

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

// P2-3: デモlib(talkbalancer-demo.ts)のモジュールスコープ計測状態
// (metricBuf/loudSince/lastAuto)が startSession/endSession でリセットされる
// ことを確認する回帰テスト。サーバー版(_reset_metrics_locked)と同等の挙動。
//
// metricBuf 等はモジュールスコープでテスト間を跨いで残るため、各テストの
// 冒頭で endSession()→startSession(...) して状態を確定させてから検証する。

describe('talkbalancer-demo: セッション跨ぎの計測状態リセット', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    demo.endSession();
  });

  it('samples はセッションを跨いで持ち越されない', () => {
    demo.endSession();
    demo.startSession('t', 'volume_only');
    demo.ingestLocalMetric(0.05);
    demo.ingestLocalMetric(0.05);
    const third = demo.ingestLocalMetric(0.05);
    expect(third.samples).toBe(3);

    demo.endSession();
    demo.startSession('t', 'volume_only');
    const afterRestart = demo.ingestLocalMetric(0);
    expect(afterRestart.samples).toBe(1);
  });

  it('自動アラート(too_loud)の継続判定・クールダウンはセッションを跨いで持ち越されない', () => {
    demo.endSession();
    demo.startSession('t', 'volume_only');

    const base = 1_000_000_000_000; // ms
    const nowSpy = jest.spyOn(Date, 'now');

    // セッションA: 騒音が30秒以上継続 → 自動アラート発火
    nowSpy.mockReturnValue(base);
    demo.ingestLocalMetric(0.2); // loudSince = base/1000
    nowSpy.mockReturnValue(base + 31_000);
    demo.ingestLocalMetric(0.2); // 継続31秒 & クールダウン(lastAuto=0)超過 → 発火

    const alertsA = demo.listAlerts(0);
    expect(alertsA.alerts.some((a) => a.type === 'too_loud' && a.source === 'auto')).toBe(true);

    // セッション終了→再開: loudSince/lastAuto がリセットされる
    demo.endSession();
    demo.startSession('t', 'volume_only');
    const afterSeq = demo.listAlerts(0).seq;

    // 新セッション直後に1回だけ投入 → 継続時間0なので発火しない(loudSinceリセット済)
    nowSpy.mockReturnValue(base + 100_000);
    demo.ingestLocalMetric(0.2);
    expect(demo.listAlerts(afterSeq).alerts.some((a) => a.type === 'too_loud' && a.source === 'auto')).toBe(false);

    // さらに31秒後に投入 → lastAuto がリセット済(0)なので300秒クールダウンを待たず再度発火する
    nowSpy.mockReturnValue(base + 131_000);
    demo.ingestLocalMetric(0.2);
    expect(demo.listAlerts(afterSeq).alerts.some((a) => a.type === 'too_loud' && a.source === 'auto')).toBe(true);
  });

});
