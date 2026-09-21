import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionChatMessage } from '../types/remote-session-chat';
import {
  mockRemoteSessionChatService as service,
  REMOTE_SESSION_END_USER_NAME,
  simulateRemoteSessionUserReply,
} from './remote-session-chat-service';

const technician = { name: 'Roman K.' };

/** Awaits a service call under fake timers by draining the mock latency. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(250);
  return promise;
}

describe('MockRemoteSessionChatService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    service.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts every dialog empty', async () => {
    expect(await settle(service.history('d1'))).toEqual([]);
  });

  it('stores a sent message under the technician and delivers it to subscribers', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d1', m => received.push(m));
    const sent = await settle(service.send('d1', 'Hi Anthony', technician));
    expect(sent).toMatchObject({ author: 'technician', authorName: 'Roman K.', body: 'Hi Anthony' });
    expect(received).toEqual([sent]);
    expect(await settle(service.history('d1'))).toEqual([sent]);
  });

  it('answers a technician message with a scripted end-user reply', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d1', m => received.push(m));
    await settle(service.send('d1', 'What is wrong?', technician));
    expect(received).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(received).toHaveLength(2);
    expect(received[1]).toMatchObject({ author: 'user', authorName: REMOTE_SESSION_END_USER_NAME });
    expect(received[1].body.length).toBeGreaterThan(0);
  });

  it('injects an end-user reply on demand with the given text', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d2', m => received.push(m));
    simulateRemoteSessionUserReply('d2', 'Is it done?');
    expect(received).toEqual([expect.objectContaining({ author: 'user', body: 'Is it done?' })]);
  });

  it('drops a pending scripted reply when the last subscriber leaves', async () => {
    const received: RemoteSessionChatMessage[] = [];
    const stop = service.subscribe('d3', m => received.push(m));
    await settle(service.send('d3', 'Still there?', technician));
    stop();
    await vi.advanceTimersByTimeAsync(2_500);
    expect(await settle(service.history('d3'))).toHaveLength(1);
    expect(received).toHaveLength(1);
  });

  it('keeps dialogs apart and stops delivering after unsubscribe', async () => {
    const d1: RemoteSessionChatMessage[] = [];
    const d2: RemoteSessionChatMessage[] = [];
    const stop = service.subscribe('d1', m => d1.push(m));
    service.subscribe('d2', m => d2.push(m));
    simulateRemoteSessionUserReply('d1');
    expect(d1).toHaveLength(1);
    expect(d2).toHaveLength(0);
    stop();
    simulateRemoteSessionUserReply('d1');
    expect(d1).toHaveLength(1);
    expect(await settle(service.history('d1'))).toHaveLength(2);
  });
});
