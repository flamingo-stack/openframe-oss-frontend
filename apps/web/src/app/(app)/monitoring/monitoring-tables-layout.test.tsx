/**
 * The monitoring tables draw the grid table only where the server serves `data-table-grid` as on: the Policies and
 * Queries tabs, a device's Policies and Queries tabs, a policy's devices and a query's devices. Where the flag is off,
 * or has no value, each keeps its card rows; while the flags are out each is in a loading scope, on card rows.
 *
 * The two lists of policies are the lib's `PoliciesTable`, so what is locked for them is what the host hands it. The
 * two lists of queries and the two device tables own their columns, so they are drawn for real.
 */

import type { PoliciesTableProps } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import type { Device } from '../devices/types/device.types';
import type { PolicyDeviceRow } from './policy/types/policy-device-row';
import type { QueryDeviceRow } from './query/types/query-device-row';
import type { Policy } from './types/policies.types';
import type { Query } from './types/queries.types';

const env = vi.hoisted(() => ({
  policiesTable: null as (PoliciesTableProps & { inLoadingScope: boolean }) | null,
  useLoadingScope: (): boolean => false,
  policies: [] as Policy[],
  policyDevices: [] as PolicyDeviceRow[],
  queryDevices: [] as QueryDeviceRow[],
  devicesLoading: false,
  queries: [] as Query[],
  hostQueries: [] as { report_id: number; name: string; description: string }[],
  queriesLoading: false,
}));

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
// One router and one address for the whole run: the hooks that read them compare by identity.
vi.mock('next/navigation', () => {
  const router = { push: () => undefined, replace: () => undefined };
  const searchParams = new URLSearchParams();
  return { useRouter: () => router, usePathname: () => '/monitoring', useSearchParams: () => searchParams };
});
// The lists of policies are the lib's table: a stand-in that keeps what the host hands it, and whether the host drew
// it in a loading scope.
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', async importOriginal => ({
  ...(await importOriginal<object>()),
  // The scope hook is handed in below, not imported here: the lib's `ui` entry and this one share modules, and
  // importing one while the other is being replaced never settles.
  PoliciesTable: (props: PoliciesTableProps) => {
    env.policiesTable = { ...props, inLoadingScope: env.useLoadingScope() };
    return null;
  },
  PolicySummaryCards: () => null,
}));
vi.mock('./hooks/use-policies', () => {
  const refetch = () => undefined;
  const deletePolicy = () => undefined;
  return {
    usePolicies: () => ({
      policies: env.policies,
      isLoading: false,
      isOffline: false,
      hasData: true,
      canClaimEmpty: true,
      error: null,
      refetch,
      deletePolicy,
    }),
  };
});
vi.mock('./hooks/use-queries', () => {
  const refetch = () => undefined;
  const deleteQuery = () => undefined;
  return {
    useQueries: () => ({
      queries: env.queries,
      isLoading: env.queriesLoading,
      isOffline: false,
      hasData: !env.queriesLoading,
      // A list still being read claims nothing: the page would draw "No queries yet" over its loading rows.
      canClaimEmpty: !env.queriesLoading,
      error: null,
      refetch,
      deleteQuery,
    }),
  };
});
vi.mock('../devices/hooks/use-host-queries', () => ({
  useHostQueries: () => ({ data: env.hostQueries, isLoading: env.queriesLoading }),
}));
vi.mock('@/app/(app)/mingo/hooks/use-generate-with-ai-action', () => ({ useGenerateWithAiAction: () => undefined }));
vi.mock('./components/confirm-delete-monitoring-modal', () => ({ ConfirmDeleteMonitoringModal: () => null }));
vi.mock('./policy/hooks/use-policy-devices-table', () => ({
  usePolicyDevicesTable: () => ({ rows: env.policyDevices, isLoading: env.devicesLoading }),
}));
vi.mock('./query/hooks/use-query-devices-table', () => ({
  useQueryDevicesTable: () => ({ rows: env.queryDevices, isLoading: env.devicesLoading }),
}));
vi.mock('./policy/components/quick-query-panel', () => ({
  QuickQueryPanel: ({ deviceName }: { deviceName: string }) => <div data-quick-query-panel>{deviceName}</div>,
}));

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { PoliciesTab } from '../devices/components/tabs/policies-tab';
import { QueriesTab } from '../devices/components/tabs/queries-tab';
import { Policies } from './components/tabs/policies';
import { Queries } from './components/tabs/queries';
import { PolicyDevicesTable } from './policy/components/policy-devices-table';
import { QueryDevicesTable } from './query/components/query-devices-table';

const POLICY: Policy = {
  id: 7,
  name: 'Disk encryption',
  query: 'SELECT 1',
  critical: true,
  description: 'FileVault or BitLocker is on',
  author_id: 1,
  author_name: 'Maya Chen',
  author_email: 'maya@example.com',
  resolution: '',
  platform: 'darwin,windows',
  calendar_events_enabled: false,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  passing_host_count: 3,
  failing_host_count: 1,
};

const DEVICE = {
  fleetId: 11,
  fleetTeamId: 3,
  policies: [{ id: 7, name: 'Disk encryption', critical: true, platform: 'darwin', response: 'fail' }],
} as unknown as Device;

const QUERY = {
  id: 21,
  name: 'Chrome installs',
  description: 'Devices with Chrome installed',
  interval: 3600,
} as Query;

const HOST_QUERY = { report_id: 21, name: 'Chrome installs', description: 'Devices with Chrome installed' };

const POLICY_DEVICE: PolicyDeviceRow = {
  id: '11',
  hostname: 'reception-01',
  name: 'reception-01',
  deviceType: 'desktop',
  organization: 'Acme Logistics',
  organizationImageUrl: null,
  organizationImageHash: null,
  osType: 'windows',
  complianceStatus: 'non-compliant',
  machineId: 'm-11',
  fleetHostId: 11,
};

const QUERY_DEVICE: QueryDeviceRow = {
  id: '12',
  hostname: 'maya-mba',
  name: 'maya-mba',
  deviceType: 'laptop',
  organization: 'Northbridge Legal',
  organizationImageUrl: null,
  organizationImageHash: null,
  osType: 'darwin',
  status: 'MANAGED',
  connectivity: 'ONLINE',
  lastSeen: undefined,
  machineId: 'm-12',
  fleetHostId: 12,
  tags: [],
};

env.useLoadingScope = useLoadingScope;

let container: HTMLDivElement;
let root: Root;

const flag = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);
/** The server answers the flags and has no value for this one. */
const flagUnknown = () => useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);

function render(element: React.ReactElement) {
  act(() => root.render(element));
  return container.innerHTML;
}

function policiesTable() {
  if (!env.policiesTable) throw new Error('the policies table was not drawn');
  return env.policiesTable;
}

/** The button with this accessible name, as drawn now. */
function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === name);
  if (!found) throw new Error(`no button "${name}"`);
  return found;
}

/** The ids of the grid's data columns, in header order (action columns carry no id). */
function gridColumns(markup: string): string[] {
  const header = markup.slice(markup.indexOf('data-grid-header="'), markup.indexOf('data-grid-body'));
  return [...header.matchAll(/data-grid-col="([^"]+)"/g)].map(match => match[1] ?? '');
}

/** The stated width of the grid's column at `index`, in px. */
const columnWidth = (markup: string, index: number) =>
  Number(new RegExp(`--dtc${index}-w: (\\d+)px`).exec(markup)?.[1]);

/** How many loading rows the table draws. */
const loadingRows = (markup: string) => markup.split('data-loading-item').length - 1;

/** jsdom has no `ResizeObserver`, and the pages measure their sticky toolbar with one: an observer that never fires. */
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('the monitoring tables and the table flag', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', IdleResizeObserver));
  afterAll(() => vi.unstubAllGlobals());

  beforeEach(() => {
    env.policiesTable = null;
    env.policies = [POLICY];
    env.policyDevices = [POLICY_DEVICE];
    env.queryDevices = [QUERY_DEVICE];
    env.devicesLoading = false;
    env.queries = [QUERY];
    env.hostQueries = [HOST_QUERY];
    env.queriesLoading = false;
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  describe('Monitoring → Policies', () => {
    it('draws the grid table where the flag is on: it fills the page and keeps its own column layout', () => {
      flag(true);
      render(<Policies />);
      expect(policiesTable().layout).toBe('grid');
      expect(policiesTable().tableMaxHeight).toBe('fill');
      expect(policiesTable().tableSettings).toEqual({ storageKey: 'monitoring-policies' });
      expect(policiesTable().inLoadingScope).toBe(false);
      expect(policiesTable().rows.map(row => row.name)).toEqual(['Disk encryption']);
    });

    it('hands the table the auto-refresh picker for the row above it', () => {
      flag(false);
      render(<Policies />);
      expect(policiesTable().actions).toBeTruthy();
    });

    it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
      flag(false);
      render(<Policies />);
      expect(policiesTable().layout).toBe('cards');
      expect(policiesTable().inLoadingScope).toBe(false);

      act(() => flagUnknown());
      expect(policiesTable().layout).toBe('cards');
    });

    it('is card rows in a loading scope while the flags are out', () => {
      render(<Policies />);
      expect(policiesTable().layout).toBe('cards');
      expect(policiesTable().inLoadingScope).toBe(true);
    });
  });

  describe("a device's Policies tab", () => {
    it('draws the grid table where the flag is on, with no height of its own', () => {
      flag(true);
      render(<PoliciesTab device={DEVICE} />);
      expect(policiesTable().layout).toBe('grid');
      expect(policiesTable().tableMaxHeight).toBeUndefined();
      expect(policiesTable().tableSettings).toEqual({ storageKey: 'device-policies' });
      expect(policiesTable().inLoadingScope).toBe(false);
    });

    it('keeps card rows where the flag is off, and a loading scope while the flags are out', () => {
      flag(false);
      render(<PoliciesTab device={DEVICE} />);
      expect(policiesTable().layout).toBe('cards');
      expect(policiesTable().inLoadingScope).toBe(false);

      act(() => useFeatureFlagsStore.getState().reset());
      expect(policiesTable().layout).toBe('cards');
      expect(policiesTable().inLoadingScope).toBe(true);
    });
  });

  describe.each([
    {
      name: 'Monitoring → Queries',
      table: () => <Queries />,
      storageKey: 'monitoring-queries',
      fillsThePage: true,
    },
    {
      name: "a device's Queries tab",
      table: () => <QueriesTab device={DEVICE} />,
      storageKey: 'device-queries',
      fillsThePage: false,
    },
  ])('$name', ({ table, storageKey, fillsThePage }) => {
    it('draws the grid table where the flag is on, a query on one line, with the gear in its header', () => {
      flag(true);
      const markup = render(table());
      expect(markup).toContain('data-grid-root');
      expect(markup).toContain('data-grid-settings-cell');
      expect(gridColumns(markup)).toEqual(['name', 'frequencyLabel']);
      // Name 560, Frequency 200, then the row menu and the open button, 56 each.
      expect([0, 1, 2, 3].map(index => columnWidth(markup, index))).toEqual([560, 200, 56, 56]);
      // The Queries page's table is the page's scroll area; a device's tab scrolls with its page.
      expect(markup.includes('--data-table-max-height')).toBe(fillsThePage);
      expect(container.textContent).toContain('Chrome installsDevices with Chrome installed');
      expect(container.textContent).toContain('Every 1h');
    });

    it('reads the viewer’s saved column layout under its own key', () => {
      window.localStorage.setItem(
        `ods-data-table:${storageKey}`,
        JSON.stringify({ version: 1, order: [], hidden: ['frequencyLabel'], sizing: {} }),
      );
      flag(true);
      expect(gridColumns(render(table()))).toEqual(['name']);
    });

    it('draws the row menu and the open button as bare buttons in action columns', () => {
      flag(true);
      render(table());
      for (const name of ['More actions', 'Open Chrome installs']) {
        expect(button(name).className).toContain('size-10');
        expect(button(name).className).not.toContain('bg-ods-card');
      }
    });

    it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
      flag(false);
      expect(render(table())).not.toContain('data-grid-');
      expect(container.textContent).toContain('Chrome installs');
      expect(button('Open Chrome installs').className).toContain('bg-ods-card');

      act(() => flagUnknown());
      expect(container.innerHTML).not.toContain('data-grid-');
    });

    it('is loading card rows while the flags are out, then the grid with its rows', () => {
      const out = render(table());
      expect(out).not.toContain('data-grid-');
      expect(loadingRows(out)).toBeGreaterThan(0);
      expect(container.textContent).not.toContain('Chrome installs');

      act(() => {
        flag(true);
      });
      expect(container.innerHTML).toContain('data-grid-root');
      expect(container.textContent).toContain('Chrome installs');
    });

    it('draws its own loading rows as grid rows while its queries are read', () => {
      env.queriesLoading = true;
      env.queries = [];
      env.hostQueries = [];
      flag(true);
      const markup = render(table());
      expect(markup).toContain('data-grid-root');
      expect(loadingRows(markup.slice(markup.indexOf('data-grid-body')))).toBeGreaterThan(0);
      // A loading table names no column, and keeps both action columns so nothing moves when the rows arrive.
      expect(markup).toContain('data-grid-header-loading');
      expect([2, 3].map(index => columnWidth(markup, index))).toEqual([56, 56]);
    });
  });

  describe.each([
    {
      name: "a policy's devices",
      table: () => <PolicyDevicesTable policyId={7} assignedHostIds={[]} policyQuery="SELECT 1" />,
      device: 'reception-01',
      customer: 'Acme Logistics',
      storageKey: 'monitoring-policy-devices',
    },
    {
      name: "a query's devices",
      table: () => <QueryDevicesTable queryId={7} query="SELECT 1" />,
      device: 'maya-mba',
      customer: 'Northbridge Legal',
      storageKey: 'monitoring-query-devices',
    },
  ])('$name', ({ table, device, customer, storageKey }) => {
    it('draws the grid table where the flag is on, with its count above it and the gear in its header', () => {
      flag(true);
      const markup = render(table());
      expect(markup).toContain('data-grid-root');
      expect(markup).toContain('data-grid-settings-cell');
      expect(markup.indexOf('data-grid-meta')).toBeLessThan(markup.indexOf('data-grid-header'));
      // No height of its own: the page scrolls.
      expect(markup).not.toContain('--data-table-max-height');
      expect(container.textContent).toContain(device);
      expect(container.textContent).toContain(customer);
      expect(container.textContent).toContain('1 result');
    });

    it('reads the viewer’s saved column layout under its own key', () => {
      // The lib keeps a named table's layout at `ods-data-table:<storageKey>`: here the viewer hid the OS column.
      window.localStorage.setItem(
        `ods-data-table:${storageKey}`,
        JSON.stringify({ version: 1, order: [], hidden: ['os'], sizing: {} }),
      );
      flag(true);
      const markup = render(table());
      expect(markup).toContain('data-grid-col="device"');
      expect(markup).not.toContain('data-grid-col="os"');
    });

    it('draws the row actions as bare buttons in action columns, and Quick Query as its icon alone', () => {
      flag(true);
      render(table());
      for (const name of ['Open in new tab', 'Open quick query']) {
        expect(button(name).className).toContain('size-10');
        expect(button(name).className).not.toContain('bg-ods-card');
      }
      expect(button('Open quick query').textContent).toBe('');
    });

    it('opens the Quick Query panel under the row in the grid, and closes it', () => {
      flag(true);
      render(table());
      expect(container.querySelector('[data-quick-query-panel]')).toBeNull();
      act(() => button('Open quick query').click());
      expect(container.querySelector('[data-quick-query-panel]')?.textContent).toBe(device);
      expect(button('Close quick query').getAttribute('aria-expanded')).toBe('true');
      act(() => button('Close quick query').click());
      expect(container.querySelector('[data-quick-query-panel]')).toBeNull();
    });

    it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
      flag(false);
      expect(render(table())).not.toContain('data-grid-');
      expect(container.textContent).toContain(device);
      // A card row prints the toggle's label from `md` up.
      expect(button('Open quick query').textContent).toBe('Quick Query');
      expect(button('Open in new tab').className).toContain('bg-ods-card');

      act(() => flagUnknown());
      expect(container.innerHTML).not.toContain('data-grid-');
    });

    it('is loading card rows while the flags are out, then the grid with its rows', () => {
      const out = render(table());
      expect(out).not.toContain('data-grid-');
      expect(loadingRows(out)).toBeGreaterThan(0);
      expect(container.textContent).not.toContain(device);

      act(() => {
        flag(true);
      });
      expect(container.innerHTML).toContain('data-grid-root');
      expect(container.textContent).toContain(device);
    });

    it('draws its own loading rows as grid rows while its devices are read', () => {
      env.devicesLoading = true;
      env.policyDevices = [];
      env.queryDevices = [];
      flag(true);
      const markup = render(table());
      expect(markup).toContain('data-grid-root');
      expect(loadingRows(markup.slice(markup.indexOf('data-grid-body')))).toBe(5);
      // A loading table names no column.
      expect(markup).toContain('data-grid-header-loading');
    });
  });
});
