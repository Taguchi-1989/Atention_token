import { API_BASE_URL } from '@/lib/api';

describe('API Configuration', () => {
  it('has API base URL set', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
  });

  it('defaults to /api when env not set', () => {
    // All API calls go to /api/* prefix
    expect(API_BASE_URL).toBe('/api');
  });
});
