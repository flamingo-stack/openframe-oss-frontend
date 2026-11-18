/**
 * The chat's reads try again after a failure, as they did under react-query; commands and dead sessions do not.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGoneError } from '@/lib/session-health';
import { retryingRead } from './retrying-read';

const polls = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/lib/session-poll', () => ({ sessionPollsAllowed: () => polls.allowed }));

beforeEach(() => {
  vi.useFakeTimers();
  polls.allowed = true;
});
afterEach(() => vi.useRealTimers());

describe('retryingRead', () => {
  it('answers with the try that succeeds after a failure', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('502')).mockResolvedValueOnce('page');
    const answer = retryingRead(read)('d-1');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(answer).resolves.toBe('page');
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith('d-1');
  });

  it('gives up after three more tries, with the last failure', async () => {
    const read = vi.fn().mockRejectedValue(new Error('503'));
    const failure = retryingRead(read)().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);
    expect(await failure).toEqual(new Error('503'));
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('does not try again for a session that is gone, or while the session is paused', async () => {
    const gone = vi.fn().mockRejectedValue(new SessionGoneError());
    await expect(retryingRead(gone)()).rejects.toBeInstanceOf(SessionGoneError);
    expect(gone).toHaveBeenCalledTimes(1);

    polls.allowed = false;
    const paused = vi.fn().mockRejectedValue(new Error('401'));
    await expect(retryingRead(paused)()).rejects.toThrow('401');
    expect(paused).toHaveBeenCalledTimes(1);
  });
});
