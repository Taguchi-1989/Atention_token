import * as demo from '@/lib/talkbalancer-demo';

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

  it('未実装モードでの startSession は既存どおり throw する(回帰ガード)', () => {
    demo.endSession();
    expect(() => demo.startSession('t', 'balance')).toThrow();
  });
});
