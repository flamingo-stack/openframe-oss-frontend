import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogHistoryMessage } from '@/lib/dialog-messages-page';
import { REMOTE_SESSION_END_USER_NAME } from '../types/remote-session-chat';
import { RemoteSessionChatApiService } from './remote-session-chat-api-service';

const tickets = vi.hoisted(() => ({
  fetchMessages: vi.fn(),
}));

vi.mock('@/app/(app)/tickets/services', () => ({ ticketService: tickets }));

const DIALOG_ID = '6ab3dc7f39817b02bf2d58a8';

function message(overrides: Partial<DialogHistoryMessage> & { id: string }): DialogHistoryMessage {
  return {
    dialogId: DIALOG_ID,
    chatType: 'CLIENT_CHAT',
    dialogMode: 'DIRECT',
    createdAt: '2026-09-23T10:00:00Z',
    lastChunkStreamSeq: null,
    owner: { type: 'CLIENT', machineId: 'machine-1' },
    parts: [{ type: 'TEXT', text: '' }],
    ...overrides,
  };
}

const service = new RemoteSessionChatApiService();

describe('RemoteSessionChatApiService', () => {
  beforeEach(() => {
    tickets.fetchMessages.mockReset();
  });

  it('reads the client-chat page oldest first, TEXT rows by owner', async () => {
    tickets.fetchMessages.mockResolvedValueOnce({
      messages: [
        message({
          id: 'm4',
          createdAt: '2026-09-23T10:03:00Z',
          lastChunkStreamSeq: 14,
          parts: [
            { type: 'TEXT', text: 'a' },
            { type: 'TEXT', text: 'b' },
          ],
        }),
        message({
          id: 'm3',
          lastChunkStreamSeq: 13,
          owner: { type: 'ASSISTANT', model: 'x' },
          parts: [{ type: 'TEXT', text: 'not a chat line' }],
        }),
        message({
          id: 'm2',
          createdAt: '2026-09-23T10:01:00Z',
          lastChunkStreamSeq: 12,
          owner: { type: 'ADMIN', userId: 'u1', user: { id: 'u1', firstName: 'Roman', lastName: 'K.' } },
          parts: [{ type: 'TEXT', text: 'Hi' }],
        }),
        message({
          id: 'm1',
          createdAt: '2026-09-23T10:00:30Z',
          lastChunkStreamSeq: 10,
          parts: [{ type: 'TEXT', text: 'Hello' }],
        }),
        message({ id: 'm0', lastChunkStreamSeq: 9, parts: [{ type: 'SYSTEM', text: 'joined' }] }),
      ],
      pageInfo: {},
    });
    const page = await service.history(DIALOG_ID);
    expect(tickets.fetchMessages).toHaveBeenCalledWith({
      dialogId: DIALOG_ID,
      chatType: 'CLIENT_CHAT',
      limit: 50,
    });
    expect(page.messages).toEqual([
      {
        id: 'm1',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:00:30Z',
        body: 'Hello',
      },
      { id: 'm2', author: 'technician', authorName: 'Roman K.', sentAt: '2026-09-23T10:01:00Z', body: 'Hi' },
      {
        id: 'm4:0',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:03:00Z',
        body: 'a',
      },
      {
        id: 'm4:1',
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: '2026-09-23T10:03:00Z',
        body: 'b',
      },
    ]);
  });

  it('names a technician row without a user profile and reports an empty dialog', async () => {
    tickets.fetchMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm1', owner: { type: 'ADMIN', userId: 'u1' }, parts: [{ type: 'TEXT', text: 'Hi' }] })],
      pageInfo: {},
    });
    expect((await service.history(DIALOG_ID)).messages[0]).toMatchObject({ authorName: 'Technician' });
    tickets.fetchMessages.mockResolvedValueOnce({ messages: [], pageInfo: {} });
    expect(await service.history(DIALOG_ID)).toEqual({ messages: [] });
  });
});
