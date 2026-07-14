describe('TalkBalancer static hosting fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('starts a local demo session when static hosting rejects POST with 405', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 405, ok: false } as Response);
    global.fetch = fetchMock as typeof fetch;

    const { isDemoMode, startTbSession } = await import('@/lib/talkbalancer');
    const state = await startTbSession('テスト会', 'volume_only', ['Aさん', 'Bさん']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.active).toBe(true);
    expect(state.participants).toHaveLength(2);
    expect(isDemoMode()).toBe(true);
    expect(window.sessionStorage.getItem('talkbalancer_demo_mode_v1')).toBe('1');
  });

  it('keeps demo mode across page-module reloads in the same tab', async () => {
    window.sessionStorage.setItem('talkbalancer_demo_mode_v1', '1');
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const { fetchTbSession, isDemoMode } = await import('@/lib/talkbalancer');
    const state = await fetchTbSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.active).toBe(false);
    expect(isDemoMode()).toBe(true);
  });
});
