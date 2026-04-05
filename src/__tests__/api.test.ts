import { API_BASE_URL } from '@/lib/api';

describe('API Configuration', () => {
  it('has API base URL set', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
  });

  it('defaults to empty string (same origin) when env not set', () => {
    // Same-origin: no prefix needed when served by FastAPI
    expect(API_BASE_URL).toBe('');
  });
});
