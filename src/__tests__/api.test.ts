import { API_BASE_URL } from '@/lib/api';

describe('API Configuration', () => {
  it('has API base URL set', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
  });

  it('defaults to localhost when env not set', () => {
    // In test environment, NEXT_PUBLIC_API_BASE_URL is not set
    expect(API_BASE_URL).toBe('http://localhost:8000');
  });
});
