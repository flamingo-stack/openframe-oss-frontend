/**
 * The "Needs you" tickets source asks the ai-agent for the escalated tickets of the Tech
 * Required lanes, and asks nothing when the tenant has no such lane: an empty `statusIds`
 * would not narrow the list at all.
 */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceReport } from './needs-you-rows';
import { useEscalatedTicketsReport } from './use-escalated-tickets-report';

const env = vi.hoisted(() => ({
  statuses: [] as Array<{ id: string; kind: string }>,
  fetchEscalatedTickets: vi.fn(),
}));

vi.mock('@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query', () => ({
  useTicketStatusesQuery: ({ enabled }: { enabled: boolean }) =>
    useQuery({
      queryKey: ['test-statuses'],
      queryFn: () => Promise.resolve({ snapshot: env.statuses }),
      enabled,
    }),
}));
vi.mock('@/app/(app)/tickets/services', () => ({
  ticketService: { fetchEscalatedTickets: env.fetchEscalatedTickets },
}));

let report: SourceReport | undefined;
let container: HTMLDivElement;
let root: Root;

function Probe() {
  const next = useEscalatedTicketsReport('on');
  useEffect(() => {
    report = next;
  });
  return null;
}

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  // The statuses answer, then the tickets: a few turns of the query client.
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(report?.status).toBe('ready');
  });
}

beforeEach(() => {
  report = undefined;
  env.fetchEscalatedTickets.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useEscalatedTicketsReport', () => {
  it('asks for the escalated tickets of every Tech Required lane', async () => {
    env.statuses = [
      { id: 'st-ai', kind: 'AI_ASSISTANCE' },
      { id: 'st-tech', kind: 'TECH_REQUIRED' },
    ];
    env.fetchEscalatedTickets.mockResolvedValue([]);

    await render();

    expect(env.fetchEscalatedTickets).toHaveBeenCalledWith({ statusIds: ['st-tech'], limit: 5 });
    expect(report).toEqual({ status: 'ready', rows: [] });
  });

  it('asks nothing without a Tech Required lane', async () => {
    env.statuses = [{ id: 'st-ai', kind: 'AI_ASSISTANCE' }];

    await render();

    expect(env.fetchEscalatedTickets).not.toHaveBeenCalled();
    expect(report).toEqual({ status: 'ready', rows: [] });
  });
});
