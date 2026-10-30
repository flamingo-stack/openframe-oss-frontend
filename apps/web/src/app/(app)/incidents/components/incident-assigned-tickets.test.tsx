import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentAssignedTickets } from './incident-assigned-tickets';

const useAssignedItems = vi.hoisted(() => vi.fn());

vi.mock('react-relay', () => ({ graphql: () => null, useFragment: (_: unknown, ref: unknown) => ref }));
vi.mock('@/components/assignments/use-assigned-items', async importOriginal => ({
  ...(await importOriginal<object>()),
  useAssignedItems,
}));

const draw = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <IncidentAssignedTickets incidentId="i1" />
    </QueryClientProvider>,
  );

const read = (over: Record<string, unknown>) => ({
  value: {},
  isLoading: false,
  loadingTypes: {},
  isReady: true,
  isOffline: false,
  failedTypes: {},
  loadFailed: false,
  retry: () => undefined,
  ...over,
});

describe('IncidentAssignedTickets', () => {
  beforeEach(() => useAssignedItems.mockReset());

  it('draws nothing while the read is on its way', () => {
    useAssignedItems.mockReturnValue(read({ isLoading: true }));
    expect(draw()).toBe('');
  });

  it('draws nothing for an incident with no tickets', () => {
    useAssignedItems.mockReturnValue(read({}));
    expect(draw()).toBe('');
  });

  it('draws nothing when only a kind the incident does not show failed', () => {
    useAssignedItems.mockReturnValue(read({ failedTypes: { ORGANIZATION: true }, loadFailed: true }));
    expect(draw()).toBe('');
  });

  it('draws the section with the reason when the read failed', () => {
    useAssignedItems.mockReturnValue(read({ failedTypes: { TICKET: true }, loadFailed: true }));
    const html = draw();
    expect(html).toContain('Assigned Ticket');
    expect(html).toContain('load assigned items');
  });
});
