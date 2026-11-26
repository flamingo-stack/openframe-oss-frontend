/**
 * The machine's own accounts are always the Local Accounts tab, under that name. Users is the directory's users and is
 * shown only where the tenant has a directory, with Directory beside it. While the flags are read, the page is main's
 * (stage and prod run without `tenant-management-v2`): Local Accounts and no directory tabs. Once phase 2 is on and only
 * the synced-connection count is out, the directory tabs keep their place in their loading form.
 */

import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';

const flags = vi.hoisted(() => ({ phase2: 'on' as FeatureFlagGate, tableGrid: 'off' as FeatureFlagGate }));
// The app's one table flag (`data-table-grid`), as the real hook answers it: its gate, and the layout for a gate.
vi.mock('@/app/hooks/use-table-layout', () => ({
  useTableGridGate: () => flags.tableGrid,
  tableLayoutFor: (gate: FeatureFlagGate) => (gate === 'on' ? 'grid' : 'cards'),
}));
vi.mock('@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate', () => ({
  useTenantManagementV2Gate: () => flags.phase2,
}));
vi.mock('../../hooks/use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => 'on' }));
vi.mock('@/app/(app)/incidents/hooks/use-incidents-gate', () => ({ useIncidentsGate: () => 'on' }));

// The tabs are stand-ins: what is under test is which one each gate value picks, and the real ones need Relay. A tab
// with a table also shows the layout it was handed and whether it sits in a loading scope (`data-table`).
vi.mock('./users-tab', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return {
    UsersTab: ({ tableLayout }: { tableLayout?: string }) => {
      const loading = useLoadingScope();
      return (
        <div data-table={`${tableLayout}${loading ? ', loading' : ''}`}>
          {loading ? 'local accounts, loading' : 'local accounts'}
        </div>
      );
    },
  };
});
vi.mock('./directory-users-tab', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return {
    DirectoryUsersTab: ({ tableLayout }: { tableLayout?: string }) => {
      const loading = useLoadingScope();
      return (
        <div data-table={`${tableLayout}${loading ? ', loading' : ''}`}>
          {loading ? 'directory users, loading' : 'directory users'}
        </div>
      );
    },
  };
});
const tableTab = vi.hoisted(() => async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return function TableTab({ tableLayout }: { tableLayout?: string }) {
    return <div data-table={`${tableLayout}${useLoadingScope() ? ', loading' : ''}`} />;
  };
});
vi.mock('./directory-tab', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return { DirectoryTab: () => <div>{useLoadingScope() ? 'directory records, loading' : 'directory records'}</div> };
});
vi.mock('./agents-tab', () => ({ AgentsTab: () => null }));
vi.mock('./device-logs/device-logs-tab', () => ({ DeviceLogsTab: () => null }));
vi.mock('./hardware-tab', () => ({ HardwareTab: () => null }));
vi.mock('./incidents-tab', () => ({ IncidentsTab: () => null }));
vi.mock('./network-tab', () => ({ NetworkTab: () => null }));
vi.mock('./os-tab', () => ({ OsTab: () => null }));
vi.mock('./overview-tab', () => ({ OverviewTab: () => null }));
vi.mock('./policies-tab', () => ({ PoliciesTab: () => null }));
vi.mock('./remote-sessions-tab', async () => ({ RemoteSessionsTab: await tableTab() }));
vi.mock('./security-tab', () => ({ SecurityTab: () => null }));
vi.mock('./software-tab', async () => ({ SoftwareTab: await tableTab() }));
vi.mock('./tickets-tab', async () => ({ TicketsTab: await tableTab() }));
vi.mock('./vulnerabilities-tab', async () => ({ VulnerabilitiesTab: await tableTab() }));
vi.mock('@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-tab', () => ({
  AssignedArticlesTab: () => null,
}));
vi.mock('@/app/(app)/knowledge-base/components/assigned-articles/assigned-articles-target', () => ({
  deviceArticlesTarget: () => null,
}));

import { ALL_DEVICE_TABS, DeviceDirectoryGateContext, resolveDeviceTab, useDeviceTabs } from './device-tabs';

let container: HTMLDivElement;
let root: Root;

function renderTab(id: string, gate: FeatureFlagGate) {
  const Tab = ALL_DEVICE_TABS.find(tab => tab.id === id)?.component as ComponentType<{ device: null }>;
  act(() => {
    root.render(
      <DeviceDirectoryGateContext.Provider value={gate}>
        <Tab device={null} />
      </DeviceDirectoryGateContext.Provider>,
    );
  });
  return container.textContent;
}

function TabList({ gate }: { gate: FeatureFlagGate }) {
  return <div>{useDeviceTabs(gate).map(tab => `${tab.id} `)}</div>;
}

function tabIds(gate: FeatureFlagGate) {
  act(() => {
    root.render(<TabList gate={gate} />);
  });
  return container.textContent?.split(' ');
}

describe('device tabs and the directory gate', () => {
  beforeEach(() => {
    flags.phase2 = 'on';
    flags.tableGrid = 'off';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows Local Accounts and no Users or Directory where the tenant has no directory', () => {
    expect(renderTab('local-accounts', 'off')).toBe('local accounts');
    expect(tabIds('off')).toContain('local-accounts');
    expect(tabIds('off')).not.toContain('users');
    expect(tabIds('off')).not.toContain('directory');
  });

  it('labels the local accounts tab Local Accounts', () => {
    expect(ALL_DEVICE_TABS.find(tab => tab.id === 'local-accounts')?.label).toBe('Local Accounts');
  });

  it('shows directory users, the local accounts beside them and the Directory tab where it has one', () => {
    expect(renderTab('users', 'on')).toBe('directory users');
    expect(renderTab('local-accounts', 'on')).toBe('local accounts');
    expect(tabIds('on')).toEqual(expect.arrayContaining(['users', 'local-accounts', 'directory']));
    expect(tabIds('on')?.indexOf('local-accounts')).toBe((tabIds('on')?.indexOf('users') ?? -2) + 1);
  });

  it("draws main's Local Accounts tab, and no directory tabs, while the flags are read", () => {
    flags.phase2 = 'loading';
    expect(tabIds('loading')).toContain('local-accounts');
    expect(tabIds('loading')).not.toContain('users');
    expect(tabIds('loading')).not.toContain('directory');
  });

  it('keeps the directory tabs in place, loading, while phase 2 is on and the connection count is out', () => {
    expect(tabIds('loading')).toEqual(expect.arrayContaining(['users', 'directory', 'local-accounts']));
    expect(renderTab('users', 'loading')).toBe('directory users, loading');
    expect(renderTab('directory', 'loading')).toBe('directory records, loading');
    expect(renderTab('local-accounts', 'loading')).toBe('local accounts');
  });

  it("is main's page where phase 2 is off", () => {
    flags.phase2 = 'off';
    expect(tabIds('off')).toContain('local-accounts');
    expect(tabIds('off')).not.toContain('users');
    expect(tabIds('off')).not.toContain('directory');
  });
});

/**
 * The tabs with a table take the app's one table flag (`data-table-grid`): the grid table when it is on, card rows when
 * it is off, and a loading form while it is read, so that a table never draws one layout and swaps to the other.
 */
describe('device tabs and the table flag', () => {
  /** Every tab whose table moves with the flag; `users` is the directory users where the tenant has a directory. */
  const TABLE_TABS = ['users', 'local-accounts', 'software', 'vulnerabilities', 'tickets', 'remote-sessions'] as const;

  beforeEach(() => {
    flags.phase2 = 'on';
    flags.tableGrid = 'off';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const tableOf = (id: string, directory: FeatureFlagGate = 'on') => {
    renderTab(id, directory);
    return container.querySelector('[data-table]')?.getAttribute('data-table');
  };

  it('hands every table tab the grid layout while the flag is on', () => {
    flags.tableGrid = 'on';
    for (const id of TABLE_TABS) expect(tableOf(id), id).toBe('grid');
    // The machine's local accounts, where the tenant has no directory.
    expect(tableOf('local-accounts', 'off')).toBe('grid');
    expect(container.textContent).toBe('local accounts');
  });

  it('keeps every table tab on card rows while the flag is off', () => {
    flags.tableGrid = 'off';
    for (const id of TABLE_TABS) expect(tableOf(id), id).toBe('cards');
    expect(tableOf('local-accounts', 'off')).toBe('cards');
  });

  it('draws every table tab in its loading form, on card rows, while the flag is read', () => {
    flags.tableGrid = 'loading';
    for (const id of TABLE_TABS) expect(tableOf(id), id).toBe('cards, loading');
    expect(tableOf('local-accounts', 'off')).toBe('cards, loading');
  });
});

/** A `?tab=` link opens its tab where it is shown; `users` from before Local Accounts was its own tab opens that tab. */
describe('resolveDeviceTab', () => {
  it('opens a visible tab as asked', () => {
    expect(resolveDeviceTab('users', ['overview', 'users', 'local-accounts'], 'overview')).toBe('users');
    expect(resolveDeviceTab('local-accounts', ['overview', 'local-accounts'], 'overview')).toBe('local-accounts');
  });

  it('opens Local Accounts for a users link where Users is not shown', () => {
    expect(resolveDeviceTab('users', ['overview', 'local-accounts'], 'overview')).toBe('local-accounts');
  });

  it('falls back for any other tab that is not shown', () => {
    expect(resolveDeviceTab('directory', ['overview', 'local-accounts'], 'overview')).toBe('overview');
    expect(resolveDeviceTab('users', ['overview'], 'overview')).toBe('overview');
  });
});
