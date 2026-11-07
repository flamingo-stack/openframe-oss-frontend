/**
 * The tenant-wide list's running-sessions poll: nothing is asked for without a
 * scope; with one, the list's filter goes out with `recordingState: LIVE` past
 * the Relay store, and again every 10 s.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { type TenantLiveSessionsFilter, useTenantLiveSessions } from './use-tenant-live-sessions';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
vi.mock('../components/remote-sessions/tenant-session-columns', () => ({
  toTenantSessionRow: (node: { sessionId: string }) => ({ id: node.sessionId, live: true }),
}));
vi.mock('./use-session-recordings', () => ({ LIVE_POLL_MS: 10_000 }));

let container: HTMLDivElement;
let root: Root;
let rows: TenantSessionRow[] | null | undefined;

function Probe({ filter }: { filter: TenantLiveSessionsFilter | null }) {
  const value = useTenantLiveSessions(filter);
  useEffect(() => {
    rows = value;
  });
  return null;
}

function answer(...sessionIds: string[]) {
  relay.fetchQuery.mockReturnValue({
    toPromise: () =>
      Promise.resolve({ remoteSessions: { edges: sessionIds.map(sessionId => ({ node: { sessionId } })) } }),
  });
}

async function render(filter: TenantLiveSessionsFilter | null) {
  const queryClient = new QueryClient();
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe filter={filter} />
      </QueryClientProvider>,
    ),
  );
  // React Query hands its answers over on a timer.
  await act(async () => vi.advanceTimersByTimeAsync(1));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.clearAllMocks();
  rows = undefined;
});

describe('useTenantLiveSessions', () => {
  it('asks for nothing without a scope', async () => {
    answer('s-1');
    await render(null);
    expect(relay.fetchQuery).not.toHaveBeenCalled();
    expect(rows).toBeNull();
  });

  it("reads the running sessions under the list's filter, past the store, and again every 10 s", async () => {
    answer('s-2', 's-1');
    await render({ deviceIds: ['machine-1'], organizationId: 'org-1' });
    expect(relay.fetchQuery).toHaveBeenCalledTimes(1);
    expect(relay.fetchQuery.mock.calls[0]?.slice(2)).toEqual([
      { filter: { deviceIds: ['machine-1'], organizationId: 'org-1', recordingState: 'LIVE' } },
      { fetchPolicy: 'network-only' },
    ]);
    expect(rows?.map(row => row.id)).toEqual(['s-2', 's-1']);

    answer('s-1');
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(relay.fetchQuery).toHaveBeenCalledTimes(2);
    expect(rows?.map(row => row.id)).toEqual(['s-1']);
  });
});
