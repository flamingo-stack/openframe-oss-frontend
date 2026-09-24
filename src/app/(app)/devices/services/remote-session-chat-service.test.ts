import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_SESSION_END_USER_NAME, type RemoteSessionChatMessage } from '../types/remote-session-chat';
import {
  isMockRemoteSessionDialog,
  mockRemoteSessionChatService as service,
  mockRemoteSessionDialogId,
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
    expect(await settle(service.history('d1'))).toEqual({ messages: [], lastSeq: 0 });
  });

  it('stores a sent message under the technician and delivers it to subscribers', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d1', m => received.push(m));
    await settle(service.send('d1', 'Hi Anthony', technician));
    expect(received).toEqual([
      expect.objectContaining({ author: 'technician', authorName: 'Roman K.', body: 'Hi Anthony' }),
    ]);
    expect((await settle(service.history('d1'))).messages).toEqual(received);
  });

  it('never answers a technician message on its own', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d1', m => received.push(m));
    await settle(service.send('d1', 'What is wrong?', technician));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(received).toHaveLength(1);
    expect((await settle(service.history('d1'))).messages).toHaveLength(1);
  });

  it('lets a test inject an end-user reply with the given text', async () => {
    const received: RemoteSessionChatMessage[] = [];
    service.subscribe('d2', m => received.push(m));
    service.simulateUserReply('d2', 'Is it done?');
    expect(received).toEqual([
      expect.objectContaining({ author: 'user', authorName: REMOTE_SESSION_END_USER_NAME, body: 'Is it done?' }),
    ]);
  });

  it('keeps dialogs apart and stops delivering after unsubscribe', async () => {
    const d1: RemoteSessionChatMessage[] = [];
    const d2: RemoteSessionChatMessage[] = [];
    const stop = service.subscribe('d1', m => d1.push(m));
    service.subscribe('d2', m => d2.push(m));
    service.simulateUserReply('d1', 'Hello');
    expect(d1).toHaveLength(1);
    expect(d2).toHaveLength(0);
    stop();
    service.simulateUserReply('d1', 'Still here');
    expect(d1).toHaveLength(1);
    expect((await settle(service.history('d1'))).messages).toHaveLength(2);
  });
});

describe('mock dialog ids', () => {
  it('are named after the request and recognisable', () => {
    const id = mockRemoteSessionDialogId('01REQ');
    expect(isMockRemoteSessionDialog(id)).toBe(true);
    expect(isMockRemoteSessionDialog('6ab3dc7f39817b02bf2d58a8')).toBe(false);
    expect(isMockRemoteSessionDialog(null)).toBe(false);
  });
});
