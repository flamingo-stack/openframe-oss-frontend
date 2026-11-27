/**
 * `sendMessage` carries the page a Mingo message was sent from (`currentPage`) and the
 * list on it (`currentList`) beside the entity context, and nothing it was not given.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketService } from './index';

const spies = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: spies.post, put: vi.fn(), get: vi.fn() },
  REQUEST_TIMEOUT_MS: 30_000,
}));

function sentInput(): Record<string, unknown> {
  const body = spies.post.mock.calls.at(-1)?.[1] as { variables: { input: Record<string, unknown> } };
  return body.variables.input;
}

describe('ticketService.sendMessage', () => {
  beforeEach(() => {
    spies.post.mockReset();
    spies.post.mockResolvedValue({ ok: true, data: { data: { sendMessage: { userErrors: [] } } } });
  });

  it('sends the page and its list', async () => {
    await ticketService.sendMessage('d-1', 'Give me an overview of this page', 'ADMIN_AI_CHAT', {
      currentPage: { kind: 'LIST', title: 'Devices' },
      currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
    });

    expect(sentInput()).toEqual({
      dialogId: 'd-1',
      content: 'Give me an overview of this page',
      chatType: 'ADMIN_AI_CHAT',
      currentPage: { kind: 'LIST', title: 'Devices' },
      currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
    });
  });

  it("sends a message's files by their ids, also with no text", async () => {
    await ticketService.sendMessage('d-1', '', 'ADMIN_AI_CHAT', { attachmentIds: ['att_1', 'att_2'] });

    expect(sentInput()).toEqual({
      dialogId: 'd-1',
      content: '',
      chatType: 'ADMIN_AI_CHAT',
      attachmentIds: ['att_1', 'att_2'],
    });
  });

  it('sends no file field for a message without files', async () => {
    await ticketService.sendMessage('d-1', 'hi', 'ADMIN_AI_CHAT', { attachmentIds: [] });

    expect(sentInput()).not.toHaveProperty('attachmentIds');
  });

  it('sends neither without them: a server without the fields still takes the message', async () => {
    await ticketService.sendMessage('d-1', 'hi', 'CLIENT_CHAT');

    expect(sentInput()).toEqual({ dialogId: 'd-1', content: 'hi', chatType: 'CLIENT_CHAT' });
  });
});
