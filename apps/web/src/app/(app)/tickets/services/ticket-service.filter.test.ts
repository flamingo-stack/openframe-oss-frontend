/**
 * The ticket list is scoped on the server: every axis a tab narrows on has to reach
 * `TicketFilterInput` as sent, and an empty axis must not be sent at all (the backend
 * reads an empty list as "no filter", but an absent key is what the schema contract is).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ticketService } from './index';

const spies = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: spies.post, put: vi.fn(), get: vi.fn() },
  REQUEST_TIMEOUT_MS: 30_000,
}));

const EMPTY_PAGE = {
  ok: true,
  data: {
    data: {
      tickets: {
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        filteredCount: 0,
      },
    },
  },
};

function sentFilter(): Record<string, unknown> {
  const body = spies.post.mock.calls.at(-1)?.[1] as { variables: { filter: Record<string, unknown> } };
  return body.variables.filter;
}

describe('ticketService.fetchDialogs filter', () => {
  beforeEach(() => {
    spies.post.mockReset();
    spies.post.mockResolvedValue(EMPTY_PAGE);
  });

  it('sends deviceIds as the device axis of TicketFilterInput', async () => {
    await ticketService.fetchDialogs({ statusIds: ['st-1'], deviceIds: ['machine-1'], limit: 20 });

    expect(sentFilter()).toEqual({ statusIds: ['st-1'], deviceIds: ['machine-1'] });
  });

  it('sends organizationIds as the customer axis of TicketFilterInput', async () => {
    await ticketService.fetchDialogs({ statusIds: ['st-1'], organizationIds: ['org-1'], limit: 20 });

    expect(sentFilter()).toEqual({ statusIds: ['st-1'], organizationIds: ['org-1'] });
  });

  it('leaves an empty axis out instead of sending an empty list', async () => {
    await ticketService.fetchDialogs({ statusIds: ['st-1'], deviceIds: [], organizationIds: [], limit: 20 });

    expect(sentFilter()).toEqual({ statusIds: ['st-1'] });
  });

  it('reports the server-side match count, not the page length', async () => {
    spies.post.mockResolvedValue({
      ...EMPTY_PAGE,
      data: { data: { tickets: { ...EMPTY_PAGE.data.data.tickets, filteredCount: 57 } } },
    });

    const page = await ticketService.fetchDialogs({ statusIds: ['st-1'], deviceIds: ['machine-1'], limit: 20 });

    expect(page.filteredCount).toBe(57);
    expect(page.dialogs).toEqual([]);
  });
});
