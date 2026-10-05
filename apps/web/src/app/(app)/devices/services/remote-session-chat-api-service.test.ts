import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/app/(app)/tickets/types/dialog.types';
import { REMOTE_SESSION_END_USER_NAME } from '../types/remote-session-chat';
import { decodeRemoteSessionChatChunk, RemoteSessionChatApiService } from './remote-session-chat-api-service';

const tickets = vi.hoisted(() => ({
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@/app/(app)/tickets/services', () => ({ ticketService: tickets }));

const DIALOG_ID = '6ab3dc7f39817b02bf2d58a8';

function message(overrides: Partial<Message> & { id: string }): Message {
  return {
    dialogId: DIALOG_ID,
    chatType: 'CLIENT_CHAT',
    dialogMode: 'DIRECT',
    createdAt: '2026-09-23T10:00:00Z',
    lastChunkStreamSeq: null,
    owner: { type: 'CLIENT', machineId: 'machine-1' },
    messageData: { type: 'TEXT', text: '' },
    ...overrides,
  } as Message;
}

const service = new RemoteSessionChatApiService();

describe('RemoteSessionChatApiService', () => {
  beforeEach(() => {
    tickets.fetchMessages.mockReset();
    tickets.sendMessage.mockReset();
  });

  it('reads the client-chat page oldest first, TEXT rows by owner, and remembers the last sequence', async () => {
    tickets.fetchMessages.mockResolvedValueOnce({
      messages: [
        message({
          id: 'm4',
          createdAt: '2026-09-23T10:03:00Z',
          lastChunkStreamSeq: 14,
          messageData: [
            { type: 'TEXT', text: 'a' },
            { type: 'TEXT', text: 'b' },
          ] as unknown as Message['messageData'],
        }),
        message({
          id: 'm3',
          lastChunkStreamSeq: 13,
          owner: { type: 'ASSISTANT', model: 'x' },
          messageData: { type: 'TEXT', text: 'not a chat line' },
        }),
        message({
          id: 'm2',
          createdAt: '2026-09-23T10:01:00Z',
          lastChunkStreamSeq: 12,
          owner: { type: 'ADMIN', userId: 'u1', user: { id: 'u1', firstName: 'Roman', lastName: 'K.' } },
          messageData: { type: 'TEXT', text: 'Hi' },
        }),
        message({
          id: 'm1',
          createdAt: '2026-09-23T10:00:30Z',
          lastChunkStreamSeq: 10,
          messageData: { type: 'TEXT', text: 'Hello' },
        }),
        message({ id: 'm0', lastChunkStreamSeq: 9, messageData: { type: 'SYSTEM', text: 'joined' } }),
      ],
      pageInfo: {},
    });
    const page = await service.history(DIALOG_ID);
    expect(tickets.fetchMessages).toHaveBeenCalledWith({
      dialogId: DIALOG_ID,
      chatType: 'CLIENT_CHAT',
      limit: 50,
      sortField: 'createdAt',
      sortDirection: 'DESC',
    });
    expect(page.messages).toEqual([
      {
        id: 'm1',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:00:30Z',
        body: 'Hello',
        seq: 10,
      },
      { id: 'm2', author: 'technician', authorName: 'Roman K.', sentAt: '2026-09-23T10:01:00Z', body: 'Hi', seq: 12 },
      {
        id: 'm4:0',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:03:00Z',
        body: 'a',
        seq: 14,
      },
      {
        id: 'm4:1',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:03:00Z',
        body: 'b',
        seq: 14,
      },
    ]);
    expect(page.lastSeq).toBe(14);
  });

  it('names a technician row without a user profile and reports an empty dialog', async () => {
    tickets.fetchMessages.mockResolvedValueOnce({
      messages: [
        message({ id: 'm1', owner: { type: 'ADMIN', userId: 'u1' }, messageData: { type: 'TEXT', text: 'Hi' } }),
      ],
      pageInfo: {},
    });
    expect((await service.history(DIALOG_ID)).messages[0]).toMatchObject({ authorName: 'Technician', seq: undefined });
    tickets.fetchMessages.mockResolvedValueOnce({ messages: [], pageInfo: {} });
    expect(await service.history(DIALOG_ID)).toEqual({ messages: [], lastSeq: 0 });
  });

  it('sends through the chat service as a client-chat line', async () => {
    tickets.sendMessage.mockResolvedValueOnce(undefined);
    await service.send(DIALOG_ID, 'Hello there');
    expect(tickets.sendMessage).toHaveBeenCalledWith(DIALOG_ID, 'Hello there', 'CLIENT_CHAT');
    tickets.sendMessage.mockRejectedValueOnce(new Error('403'));
    await expect(service.send(DIALOG_ID, 'x')).rejects.toThrow('403');
  });
});

describe('decodeRemoteSessionChatChunk', () => {
  it("turns the end user's direct message into a user row keyed by its sequence", () => {
    const row = decodeRemoteSessionChatChunk({
      type: 'DIRECT_MESSAGE',
      text: 'Hey',
      ownerType: 'CLIENT',
      streamSeq: 15,
    });
    expect(row).toMatchObject({
      id: 'seq-15',
      author: 'user',
      authorName: REMOTE_SESSION_END_USER_NAME,
      body: 'Hey',
      seq: 15,
    });
  });

  it("turns the technician's echo into a technician row, named from the chunk or the signed-in user", () => {
    const named = decodeRemoteSessionChatChunk(
      { type: 'DIRECT_MESSAGE', text: 'Hi', ownerType: 'ADMIN', displayName: 'Roman K.', streamSeq: 16 },
      { name: 'Someone Else' },
    );
    expect(named).toMatchObject({ author: 'technician', authorName: 'Roman K.', body: 'Hi', seq: 16 });
    const unnamed = decodeRemoteSessionChatChunk(
      { type: 'DIRECT_MESSAGE', text: 'Hi', ownerType: 'ADMIN' },
      { name: 'Roman' },
    );
    expect(unnamed).toMatchObject({ author: 'technician', authorName: 'Roman', seq: undefined });
    expect(unnamed?.id).toMatch(/^live-/);
  });

  it('drops system notices, assistant deltas, unknown owners and malformed chunks', () => {
    expect(decodeRemoteSessionChatChunk({ type: 'SYSTEM', text: 'joined the chat', streamSeq: 17 })).toBeNull();
    expect(decodeRemoteSessionChatChunk({ type: 'MESSAGE', text: 'delta', streamSeq: 18 })).toBeNull();
    expect(
      decodeRemoteSessionChatChunk({ type: 'DIRECT_MESSAGE', text: 'x', ownerType: 'ASSISTANT', streamSeq: 19 }),
    ).toBeNull();
    expect(decodeRemoteSessionChatChunk({ type: 'DIRECT_MESSAGE', ownerType: 'CLIENT', streamSeq: 20 })).toBeNull();
    expect(decodeRemoteSessionChatChunk('nope')).toBeNull();
  });
});
