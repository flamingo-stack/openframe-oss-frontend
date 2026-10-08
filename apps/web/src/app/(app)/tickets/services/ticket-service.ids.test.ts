/**
 * The ai-agent's Relay migration: node ids are globals, but routes, cache keys, NATS
 * subjects and notification ids are raw, so the view-model is keyed by the raw
 * companions; and the lists page with `first` / `after`.
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
/** What `GetTickets` selects: no `dialog`. */
const LIST_NODE = {
  id: 'VGlja2V0OjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMQ',
  ticketId: RAW_TICKET_ID,
  ticketNumber: 7,
  title: 'Printer offline',
  owner: { type: 'ADMIN' },
  createdAt: '2026-10-07T10:00:00Z',
};
/** What `GetTicket` and the board's `BoardCardTicket` select on top. */
const TICKET_NODE = {
  ...LIST_NODE,
  dialog: { id: 'RGlhbG9nOjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMA', dialogId: RAW_DIALOG_ID, currentMode: 'AI' },
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

  it('keys a list row by the raw ticket id', async () => {
    spies.post.mockResolvedValue(page([LIST_NODE]));

    const { dialogs } = await ticketService.fetchDialogs({ statusIds: [], limit: 20 });

    expect(dialogs[0].id).toBe(RAW_TICKET_ID);
  });

  it('keys a board card by the raw ticket and dialog ids', async () => {
    spies.post.mockResolvedValue(page([TICKET_NODE]));

    const { dialogs } = await ticketService.fetchBoardColumnByStatusId({ statusId: 'st-1', limit: 20 });

    expect(dialogs[0]).toMatchObject({ id: RAW_TICKET_ID, dialogId: RAW_DIALOG_ID });
  });

  it('keys the single ticket by the raw ticket and dialog ids', async () => {
    spies.post.mockResolvedValue({ ok: true, data: { data: { ticket: TICKET_NODE } } });

    const dialog = await ticketService.fetchDialog(RAW_TICKET_ID);

    expect(dialog).toMatchObject({ id: RAW_TICKET_ID, dialogId: RAW_DIALOG_ID });
  });
});

describe('ticketService paging', () => {
  beforeEach(() => {
    spies.post.mockReset();
    spies.post.mockResolvedValue(page([]));
  });

  it('pages with first / after, never the deprecated pagination argument', async () => {
    await ticketService.fetchDialogs({ statusIds: [], limit: 20, cursor: 'cur-1' });

    expect(sentVariables()).toMatchObject({ first: 20, after: 'cur-1' });
    expect(sentVariables()).not.toHaveProperty('pagination');
  });
});
