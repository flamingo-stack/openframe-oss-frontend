import { describe, expect, it } from 'vitest';
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/api-client';
import { AuthUnavailableError, shouldRetryAuthSession } from './use-auth-session';

/**
 * The session query's retry policy is what stood between one failed refresh and
 * a storm: every `/me` retry was another 401, and every 401 another refresh
 * cycle. These pin which failures `/me` retries on its own and which it leaves
 * to the `refetchInterval` backoff.
 */
describe('shouldRetryAuthSession', () => {
  it('keeps the two quick retries for an ordinary transient failure', () => {
    const error = new Error('Auth check failed with status 500');
    expect(shouldRetryAuthSession(0, error)).toBe(true);
    expect(shouldRetryAuthSession(1, error)).toBe(true);
    expect(shouldRetryAuthSession(2, error)).toBe(false);
  });

  it('never retries a failure that is the refresh itself — the refresh manager already made its attempts', () => {
    const error = new AuthUnavailableError();
    expect(shouldRetryAuthSession(0, error)).toBe(false);
  });

  it('names the failure after the API client answer it stands for', () => {
    const error = new AuthUnavailableError();
    expect(error.message).toBe(AUTH_UNAVAILABLE_MESSAGE);
    expect(error.name).toBe('AuthUnavailableError');
    expect(error).toBeInstanceOf(Error);
  });
});
