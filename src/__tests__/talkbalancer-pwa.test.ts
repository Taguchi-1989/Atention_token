import manifest from '@/app/manifest';

describe('TalkBalancer PWA manifest', () => {
  test('opens the mobile one-device mode as a standalone app', () => {
    const value = manifest();
    expect(value.name).toBe('TalkBalancer');
    expect(value.start_url).toBe('./talkbalancer/mobile');
    expect(value.display).toBe('standalone');
    expect(value.orientation).toBe('portrait');
  });

  test('provides install and maskable Android icons', () => {
    const icons = manifest().icons ?? [];
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]));
  });
});
