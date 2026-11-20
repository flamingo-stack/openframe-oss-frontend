/**
 * The logs table draws the grid table only where the server serves `data-table-grid` as on: on the Logs page (where
 * it fills the page's height), in a device's Overview tab and in a customer's Logs tab (where the page scrolls). Where
 * the flag is off, or has no value, it keeps its card rows; while the flags are out it reads nothing and draws card
 * loading rows.
 *
 * The table itself is the lib's `LogsTableView`, so what is locked here is what this host hands it.
 */

import type { LogsTableViewProps } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({
  views: [] as LogsTableViewProps[],
  queries: 0,
}));

/** One log, as the table's fragment selects it. */
const NODE = vi.hoisted(() => ({
  id: 'log-1',
  toolEventId: 'evt-1',
  eventType: 'login',
  ingestDay: '2026-11-18',
  toolType: 'FLEET_MDM',
  severity: 'INFO',
  deviceId: 'm-1',
  hostname: 'reception-01',
  nickname: null,
  organizationId: 'org-1',
  organizationName: 'Acme Logistics',
  summary: 'Sign-in from the office network',
  timestamp: '2026-11-18T10:15:00Z',
}));

// One answer, one router and one address for the whole run: the hooks that read them compare by identity.
vi.mock('react-relay', async importOriginal => {
  const query = { logFilters: null };
  const page = {
    data: { logs: { edges: [{ node: NODE }] } },
    loadNext: () => undefined,
    hasNext: false,
    isLoadingNext: false,
    refetch: () => undefined,
  };
  const environment = {};
  return {
    ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
    graphql: () => ({}),
    useLazyLoadQuery: () => {
      env.queries += 1;
      return query;
    },
    usePaginationFragment: () => page,
    useFragment: () => NODE,
    useRelayEnvironment: () => environment,
  };
});
vi.mock('next/navigation', () => {
  const router = { push: () => undefined, replace: () => undefined };
  const searchParams = new URLSearchParams();
  return { useRouter: () => router, usePathname: () => '/logs-page', useSearchParams: () => searchParams };
});
// The table and the page around it are the lib's: stand-ins that keep what this host hands the table.
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', async importOriginal => ({
  ...(await importOriginal<object>()),
  LogsTableView: (props: LogsTableViewProps) => {
    env.views.push(props);
    return null;
  },
  LogsPageView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LogDrawer: () => null,
}));
vi.mock('./log-drawer-details', () => ({ LogDrawerDetails: () => null }));
vi.mock('@/app/components/shared/log-drawer-device-card', () => ({ logDrawerDeviceCard: () => null }));

import { LogsTable } from './logs-table';

let container: HTMLDivElement;
let root: Root;

const flag = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);

/** What the host handed the table on its latest draw. */
function render(element: React.ReactElement): LogsTableViewProps {
  act(() => root.render(element));
  const view = env.views.at(-1);
  if (!view) throw new Error('the logs table was not drawn');
  return view;
}

/** The row's copy button as the host draws it for this table. */
function copyButtonClass(view: LogsTableViewProps): string {
  const [log] = view.logs;
  if (!log || !view.renderCopyAction) throw new Error('no row to copy');
  const holder = document.createElement('div');
  const holderRoot = createRoot(holder);
  act(() => holderRoot.render(view.renderCopyAction?.(log)));
  const className = holder.querySelector('button')?.className ?? '';
  act(() => holderRoot.unmount());
  return className;
}

describe('the logs table and the table flag', () => {
  beforeEach(() => {
    env.views = [];
    env.queries = 0;
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('draws the grid table on the Logs page where the flag is on: it fills the page and keeps its column layout', () => {
    flag(true);
    const view = render(<LogsTable />);
    expect(view.layout).toBe('grid');
    expect(view.tableMaxHeight).toBe('fill');
    expect(view.tableSettings).toEqual({ storageKey: 'logs' });
    expect(view.logs.map(log => log.logId)).toEqual(['evt-1']);
  });

  it('hands the grid table its date filter, and the bare copy button', () => {
    flag(true);
    const view = render(<LogsTable />);
    // The grid's Log ID header is the table's own date header, drawn from this.
    expect(view.dateFilter?.sortDirection).toBe('desc');
    expect(view.dateFilter?.range).toBeUndefined();
    expect(typeof view.dateFilter?.onApply).toBe('function');
    expect(copyButtonClass(view)).toContain('size-10');
  });

  it("states no height in a device's Overview tab and in a customer's Logs tab: the page scrolls there", () => {
    flag(true);
    const device = render(<LogsTable deviceId="m-1" deviceScoped showHeader={false} />);
    expect(device.layout).toBe('grid');
    expect(device.tableMaxHeight).toBeUndefined();
    expect(device.tableSettings).toEqual({ storageKey: 'logs-device' });

    const customer = render(<LogsTable organizationId="org-1" embedded />);
    expect(customer.layout).toBe('grid');
    expect(customer.tableMaxHeight).toBeUndefined();
    expect(customer.tableSettings).toEqual({ storageKey: 'logs-customer' });
  });

  it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
    flag(false);
    const off = render(<LogsTable />);
    expect(off.layout).toBe('cards');
    expect(off.logs).toHaveLength(1);
    expect(copyButtonClass(off)).toContain('bg-ods-card');

    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]));
    expect(env.views.at(-1)?.layout).toBe('cards');
  });

  it('reads nothing and draws card loading rows while the flags are out, then the grid with its rows', () => {
    const out = render(<LogsTable />);
    expect(out.layout).toBe('cards');
    expect(out.loading).toBe(true);
    expect(out.logs).toHaveLength(0);
    expect(env.queries).toBe(0);

    act(() => {
      flag(true);
    });
    const answered = env.views.at(-1);
    expect(answered?.layout).toBe('grid');
    expect(answered?.logs).toHaveLength(1);
    expect(env.queries).toBeGreaterThan(0);
  });
});
