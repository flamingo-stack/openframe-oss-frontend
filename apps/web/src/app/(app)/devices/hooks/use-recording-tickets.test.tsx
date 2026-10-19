/**
 * The recording page re-reads its tickets on every visit, so an assignee or
 * status changed on the Tickets pages shows up when the page is opened again,
 * even within the app-wide minute of freshness.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordingTicket } from '../components/remote-sessions/recording-tickets';
import { useRecordingTickets } from './use-recording-tickets';

const service = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('../services/recording-tickets-api-service', () => ({
  fetchRecordingTickets: service.fetch,
  assignRecordingTickets: vi.fn(),
  unassignRecordingTicket: vi.fn(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function ticket(assignedName: string): RecordingTicket {
  return { id: 'ticket-1', title: 'Disk Encryption Status', ticketNumber: 1490, assignedName } as RecordingTicket;
}

function Probe({ recordingId }: { recordingId: string }) {
  const { data } = useRecordingTickets(recordingId);
  return <span>{data?.map(t => t.assignedName).join(',')}</span>;
}

let container: HTMLElement;
let root: Root;
let queryClient: QueryClient;

function mount() {
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe recordingId="recording-1" />
      </QueryClientProvider>,
    ),
  );
}

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.fetch.mockReset();
  container = document.createElement('div');
  // The app's own defaults: a minute of freshness.
  queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000, retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
});

describe('useRecordingTickets', () => {
  it('re-reads the tickets when the page is opened again within the minute', async () => {
    service.fetch.mockResolvedValueOnce([ticket('Firsto Lasto')]);
    mount();
    await settle();
    expect(container.textContent).toBe('Firsto Lasto');

    act(() => root.unmount());
    service.fetch.mockResolvedValueOnce([ticket('Mikhail Matsykh')]);
    mount();
    await settle();

    expect(service.fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('Mikhail Matsykh');
  });
});
