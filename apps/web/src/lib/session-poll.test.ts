import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./token-store', () => ({ getTokenEpoch: () => 1, subscribeToTokenChange: () => () => undefined }));

const res = (status: number, type = 'text/html') => new Response('', { status, headers: { 'Content-Type': type } });

async function load() {
  vi.resetModules();
  const [health, poll] = await Promise.all([import('./session-health'), import('./session-poll')]);
  return { health, poll };
}

describe('sessionRetry', () => {
  it('retries up to the count while healthy', async () => {
    const { poll } = await load();
    const retry = poll.sessionRetry(2);
    expect(retry(0, new Error('x'))).toBe(true);
    expect(retry(1, new Error('x'))).toBe(true);
    expect(retry(2, new Error('x'))).toBe(false);
  });

  it('defers to a custom predicate while healthy', async () => {
    const { poll } = await load();
    const retry = poll.sessionRetry((count, error) => error.message !== 'missing' && count < 3);
    expect(retry(0, new Error('missing'))).toBe(false);
    expect(retry(0, new Error('boom'))).toBe(true);
  });

  it('never retries while paused or gone', async () => {
    const { health, poll } = await load();
    const retry = poll.sessionRetry(5);
    health.markSessionPaused('transient');
    expect(retry(0, new Error('x'))).toBe(false);
    health.markSessionHealthy();
    health.noteGatewayResponse(res(410));
    expect(retry(0, new Error('x'))).toBe(false);
  });
});

describe('sessionInterval', () => {
  it('polls while healthy and stops otherwise', async () => {
    const { health, poll } = await load();
    const interval = poll.sessionInterval(15_000);
    expect(interval()).toBe(15_000);
    health.markSessionPaused('transient');
    expect(interval()).toBe(false);
    expect(poll.sessionPollsAllowed()).toBe(false);
  });
});

describe('resumeSessionPolls', () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient();
  });

  it('refetches active polling queries when the session comes back', async () => {
    const { health, poll } = await load();
    const spy = vi.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);
    const stop = poll.resumeSessionPolls(client);
    health.markSessionPaused('transient');
    expect(spy).not.toHaveBeenCalled();
    health.markSessionHealthy();
    expect(spy).toHaveBeenCalledTimes(1);
    const { predicate, type } = spy.mock.calls[0][0] as {
      predicate: (query: { meta?: unknown }) => boolean;
      type: string;
    };
    expect(type).toBe('active');
    expect(predicate({ meta: poll.sessionPollMeta })).toBe(true);
    expect(predicate({ meta: undefined })).toBe(false);
    stop();
  });

  it('actually restarts a stopped interval', async () => {
    const { health, poll } = await load();
    const fetcher = vi.fn(() => Promise.resolve('ok'));
    health.markSessionPaused('transient');
    const { QueryObserver } = await import('@tanstack/react-query');
    const observer = new QueryObserver(client, {
      queryKey: ['poll'],
      queryFn: fetcher,
      refetchInterval: poll.sessionInterval(10),
      meta: poll.sessionPollMeta,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const stop = poll.resumeSessionPolls(client);
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(fetcher).toHaveBeenCalledTimes(1);
    health.markSessionHealthy();
    await vi.waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(2));
    stop();
    unsubscribe();
  });
});
