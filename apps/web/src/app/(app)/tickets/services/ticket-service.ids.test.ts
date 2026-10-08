/**
 * ai-agent node ids are Relay globals; everything outside GraphQL (routes, cache keys,
 * NATS subjects, notification and push ids, `markEntityNotificationsRead`) works on the
 * raw ids, so the view-model carries the raw `ticketId` / `dialogId` companions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketService } from './index';

const spies = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: spies.post, put: vi.fn(), get: vi.fn() },
  REQUEST_TIMEOUT_MS: 30_000,
}));

const RAW_TICKET_ID = '665f1c2ab3e4d5f6a7b8c9d1';
const RAW_DIALOG_ID = '665f1c2ab3e4d5f6a7b8c9d0';
const TICKET_NODE = {
  id: 'VGlja2V0OjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMQ',
  ticketId: RAW_TICKET_ID,
  ticketNumber: 7,
  title: 'Printer offline',
  owner: { type: 'ADMIN' },
  dialog: { id: 'RGlhbG9nOjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMA', dialogId: RAW_DIALOG_ID, currentMode: 'AI' },
  createdAt: '2026-10-07T10:00:00Z',
};

function page(nodes: unknown[]) {
  return {
    ok: true,
    data: {
      data: {
        tickets: {
          edges: nodes.map(node => ({ cursor: 'c', node })),
          pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
          filteredCount: nodes.length,
        },
      },
    },
  };
}

function sentVariables(): Record<string, unknown> {
  const body = spies.post.mock.calls.at(-1)?.[1] as { variables: Record<string, unknown> };
  return body.variables;
}

describe('ticketService raw ids', () => {
  beforeEach(() => {
    spies.post.mockReset();
  });

  it('maps the list row to the raw ticket and dialog ids', async () => {
    spies.post.mockResolvedValue(page([TICKET_NODE]));

    const { dialogs } = await ticketService.fetchDialogs({ statusIds: [], limit: 20 });

    expect(dialogs[0]).toMatchObject({ id: RAW_TICKET_ID, dialogId: RAW_DIALOG_ID });
  });

  it('maps the single ticket to the raw ticket and dialog ids', async () => {
    spies.post.mockResolvedValue({ ok: true, data: { data: { ticket: TICKET_NODE } } });

    const dialog = await ticketService.fetchDialog(RAW_TICKET_ID);

    expect(dialog).toMatchObject({ id: RAW_TICKET_ID, dialogId: RAW_DIALOG_ID });
  });

  it('pages with first / after, never the deprecated pagination argument', async () => {
    spies.post.mockResolvedValue(page([]));

    await ticketService.fetchDialogs({ statusIds: [], limit: 20, cursor: 'cur-1' });

    expect(sentVariables()).toMatchObject({ first: 20, after: 'cur-1' });
    expect(sentVariables()).not.toHaveProperty('pagination');
  });
});
