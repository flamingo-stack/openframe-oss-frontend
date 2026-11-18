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

  it('sends neither without them: a server without the fields still takes the message', async () => {
    await ticketService.sendMessage('d-1', 'hi', 'CLIENT_CHAT');

    expect(sentInput()).toEqual({ dialogId: 'd-1', content: 'hi', chatType: 'CLIENT_CHAT' });
  });
});

describe('ticketService.createDialog model input', () => {
  beforeEach(() => {
    spies.post.mockReset();
    spies.post.mockResolvedValue({
      ok: true,
      data: { data: { createDialog: { dialog: { id: 'relay-created', dialogId: 'created' }, userErrors: [] } } },
    });
  });
  it('carries the chosen model through the actual shared command document and request body', async () => {
    const model = { provider: 'OPENAI', modelName: 'gpt-test' } as const;
    expect(await ticketService.createDialog({ agentType: 'ADMIN', model })).toBe('created');
    expect(sentInput()).toEqual({ agentType: 'ADMIN', model });
    const [endpoint, body] = spies.post.mock.calls[0];
    expect(endpoint).toBe('/chat/graphql');
    expect(body.query).toContain('CreateDialogInput!');
    expect(body.query).toContain('createDialog(input: $input)');
  });
  it('leaves the legacy creation payload unchanged when no model is chosen', async () => {
    await ticketService.createDialog({ agentType: 'ADMIN' });
    expect(sentInput()).toEqual({ agentType: 'ADMIN' });
  });
});
