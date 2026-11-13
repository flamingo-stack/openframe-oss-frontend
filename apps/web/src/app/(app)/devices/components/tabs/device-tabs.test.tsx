/**
 * The Users tab swaps the machine's local accounts for directory users only where the tenant has a directory. A tenant
 * without one must keep its local accounts: "No users yet" there would hide accounts the machine really has. While the
 * flags are read, the page is main's (stage and prod run without `tenant-management-v2`): local accounts in their loading
 * form, and no Directory tab. Once phase 2 is on and only the synced-connection count is out, the directory tabs keep
 * their place in their loading form.
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

import { ALL_DEVICE_TABS, DeviceDirectoryGateContext, useDeviceTabs } from './device-tabs';

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

  it('keeps local accounts and hides Directory where the tenant has no directory', () => {
    expect(renderTab('users', 'off')).toBe('local accounts');
    expect(tabIds('off')).not.toContain('directory');
    expect(tabIds('off')).toContain('users');
  });

  it('shows directory users and the Directory tab where it has one', () => {
    expect(renderTab('users', 'on')).toBe('directory users');
    expect(tabIds('on')).toContain('directory');
  });

  it("draws main's Users tab in its loading form, and no Directory tab, while the flags are read", () => {
    flags.phase2 = 'loading';
    expect(tabIds('loading')).not.toContain('directory');
    expect(tabIds('loading')).toContain('users');
    expect(renderTab('users', 'loading')).toBe('local accounts, loading');
  });

  it('keeps the directory tabs in place, loading, while phase 2 is on and the connection count is out', () => {
    expect(tabIds('loading')).toContain('directory');
    expect(renderTab('users', 'loading')).toBe('directory users, loading');
    expect(renderTab('directory', 'loading')).toBe('directory records, loading');
  });

  it("is main's page where phase 2 is off", () => {
    flags.phase2 = 'off';
    expect(tabIds('off')).not.toContain('directory');
    expect(renderTab('users', 'off')).toBe('local accounts');
  });
});

/**
 * The tabs with a table take the app's one table flag (`data-table-grid`): the grid table when it is on, card rows when
 * it is off, and a loading form while it is read, so that a table never draws one layout and swaps to the other.
 */
describe('device tabs and the table flag', () => {
  /** Every tab whose table moves with the flag; `users` is the directory users where the tenant has a directory. */
  const TABLE_TABS = ['users', 'software', 'vulnerabilities', 'tickets', 'remote-sessions'] as const;

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
    expect(tableOf('users', 'off')).toBe('grid');
    expect(container.textContent).toBe('local accounts');
  });

  it('keeps every table tab on card rows while the flag is off', () => {
    flags.tableGrid = 'off';
    for (const id of TABLE_TABS) expect(tableOf(id), id).toBe('cards');
    expect(tableOf('users', 'off')).toBe('cards');
  });

  it('draws every table tab in its loading form, on card rows, while the flag is read', () => {
    flags.tableGrid = 'loading';
    for (const id of TABLE_TABS) expect(tableOf(id), id).toBe('cards, loading');
    expect(tableOf('users', 'off')).toBe('cards, loading');
  });
});
