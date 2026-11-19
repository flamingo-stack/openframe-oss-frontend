/**
 * The tenant-wide list's rows while it is open: with Watch live on, the running
 * sessions are polled under the list's scope and lead the first page once each,
 * a session started since the page came counts in the total, a running row the
 * poll no longer returns reads the page again (once), and a later page polls and
 * merges nothing. (A refused cursor is the stale-cursor boundary's: it drops to
 * the first page.)
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSessionFilter } from '@/__generated__/tenantRemoteSessionsRelayLiveQuery.graphql';
import { asInstant } from '@/lib/graphql-scalars';
import type { LiveRows } from '../components/remote-sessions/session-status';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { useTenantSessionRows } from './use-tenant-session-rows';

const hooks = vi.hoisted(() => ({
  liveRows: null as LiveRows | null,
  polled: null as TenantSessionRow[] | null,
  pollFilter: vi.fn<(filter: object | null) => void>(),
}));

vi.mock('./use-remote-session-watch-gate', () => ({ useLiveRows: () => hooks.liveRows }));
vi.mock('./use-tenant-live-sessions', () => ({
  useTenantLiveSessions: (filter: object | null) => {
    hooks.pollFilter(filter);
    return filter ? hooks.polled : null;
  },
}));

const WATCH_LIVE: LiveRows = { userId: 'tech-roman' };

const row = (id: string, live = false) => ({ id, live }) as TenantSessionRow;

type Result = ReturnType<typeof useTenantSessionRows>;

let container: HTMLDivElement;
let root: Root;
let result: Result | null = null;
const onRefresh = vi.fn();

function Probe(props: {
  pageRows: TenantSessionRow[];
  totalCount: number;
  filter: RemoteSessionFilter;
  firstPage: boolean;
}) {
  const value = useTenantSessionRows({ ...props, onRefresh });
  useEffect(() => {
    result = value;
  });
  return null;
}

function render(
  pageRows: TenantSessionRow[],
  totalCount = pageRows.length,
  filter: RemoteSessionFilter = {},
  firstPage = true,
) {
  act(() => root.render(<Probe pageRows={pageRows} totalCount={totalCount} filter={filter} firstPage={firstPage} />));
  if (!result) throw new Error('the probe did not render');
  return result;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllMocks();
  hooks.liveRows = null;
  hooks.polled = null;
  result = null;
});

describe('useTenantSessionRows', () => {
  it('polls nothing with Watch live off and shows the pages once per session', () => {
    hooks.polled = [row('new', true)];
    const { rows, totalCount } = render([row('a'), row('b'), row('a')], 7);
    expect(hooks.pollFilter).toHaveBeenLastCalledWith(null);
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
    expect(totalCount).toBe(7);
  });

  it("polls under the list's scope without its state, and not at all under a state filter", () => {
    hooks.liveRows = WATCH_LIVE;
    const from = asInstant('2026-11-01T00:00:00Z');
    render([], 0, { deviceIds: ['machine-1'], organizationId: 'org-1', from });
    expect(hooks.pollFilter).toHaveBeenLastCalledWith({ deviceIds: ['machine-1'], organizationId: 'org-1', from });
    render([], 0, { deviceIds: ['machine-1'], recordingState: 'KEPT' });
    expect(hooks.pollFilter).toHaveBeenLastCalledWith(null);
  });

  it('leads with the polled running sessions and counts one started since the first page', () => {
    hooks.liveRows = WATCH_LIVE;
    hooks.polled = [row('new', true), row('a', true)];
    const { rows, totalCount } = render([row('a', true), row('b'), row('c')], 30);
    expect(rows.map(r => r.id)).toEqual(['new', 'a', 'b', 'c']);
    expect(totalCount).toBe(31);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('reads the first page again once when a running row is no longer polled', () => {
    hooks.liveRows = WATCH_LIVE;
    hooks.polled = [row('a', true)];
    const page = [row('a', true), row('b')];
    render(page);
    expect(onRefresh).not.toHaveBeenCalled();

    hooks.polled = [];
    render(page);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // The server still lists it running on the refetched page: no second refetch for the same session.
    render([row('a', true), row('b')]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('reads the first page again once when a session shown only from the poll ends', () => {
    hooks.liveRows = WATCH_LIVE;
    const page = [row('b'), row('c')];
    hooks.polled = [];
    render(page);
    // Started after the first page: the list shows it from the poll alone.
    hooks.polled = [row('new', true)];
    expect(render(page).rows.map(r => r.id)).toEqual(['new', 'b', 'c']);
    expect(onRefresh).not.toHaveBeenCalled();

    hooks.polled = [];
    render(page);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    render([row('new'), ...page]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("polls and merges nothing on a later page: the running sessions are the first page's", () => {
    hooks.liveRows = WATCH_LIVE;
    hooks.polled = [row('new', true)];
    const { rows, totalCount } = render([row('x'), row('y')], 45, {}, false);
    expect(hooks.pollFilter).toHaveBeenLastCalledWith(null);
    expect(rows.map(r => r.id)).toEqual(['x', 'y']);
    expect(totalCount).toBe(45);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
