/**
 * The Users tab swaps the machine's local accounts for directory users only where the tenant has a directory. A tenant
 * without one must keep its local accounts: "No users yet" there would hide accounts the machine really has. While the
 * flags are read, the page is main's (stage and prod run without `tenant-management-v2`): local accounts in their loading
 * form, and no Directory tab. Once phase 2 is on and only the synced-connection count is out, the directory tabs keep
 * their place in their loading form. Where Users is the directory's, Local Accounts beside it keeps the machine's own.
 */

import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';

const flags = vi.hoisted(() => ({ phase2: 'on' as FeatureFlagGate }));
vi.mock('@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate', () => ({
  useTenantManagementV2Gate: () => flags.phase2,
}));
vi.mock('../../hooks/use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => 'on' }));
vi.mock('@/app/(app)/incidents/hooks/use-incidents-gate', () => ({ useIncidentsGate: () => 'on' }));

// The tabs are stand-ins: what is under test is which one each gate value picks, and the real ones need Relay.
vi.mock('./users-tab', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return { UsersTab: () => <div>{useLoadingScope() ? 'local accounts, loading' : 'local accounts'}</div> };
});
vi.mock('./directory-users-tab', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return { DirectoryUsersTab: () => <div>{useLoadingScope() ? 'directory users, loading' : 'directory users'}</div> };
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
vi.mock('./remote-sessions-tab', () => ({ RemoteSessionsTab: () => null }));
vi.mock('./security-tab', () => ({ SecurityTab: () => null }));
vi.mock('./software-tab', () => ({ SoftwareTab: () => null }));
vi.mock('./tickets-tab', () => ({ TicketsTab: () => null }));
vi.mock('./vulnerabilities-tab', () => ({ VulnerabilitiesTab: () => null }));
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
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps local accounts and hides Directory and Local Accounts where the tenant has no directory', () => {
    expect(renderTab('users', 'off')).toBe('local accounts');
    expect(tabIds('off')).not.toContain('directory');
    expect(tabIds('off')).not.toContain('local-accounts');
    expect(tabIds('off')).toContain('users');
  });

  it('shows directory users, the local accounts beside them and the Directory tab where it has one', () => {
    expect(renderTab('users', 'on')).toBe('directory users');
    expect(renderTab('local-accounts', 'on')).toBe('local accounts');
    expect(tabIds('on')).toEqual(expect.arrayContaining(['users', 'local-accounts', 'directory']));
    expect(tabIds('on')?.indexOf('local-accounts')).toBe((tabIds('on')?.indexOf('users') ?? -2) + 1);
  });

  it("draws main's Users tab in its loading form, and no directory tabs, while the flags are read", () => {
    flags.phase2 = 'loading';
    expect(tabIds('loading')).not.toContain('directory');
    expect(tabIds('loading')).not.toContain('local-accounts');
    expect(tabIds('loading')).toContain('users');
    expect(renderTab('users', 'loading')).toBe('local accounts, loading');
  });

  it('keeps the directory tabs in place, loading, while phase 2 is on and the connection count is out', () => {
    expect(tabIds('loading')).toEqual(expect.arrayContaining(['directory', 'local-accounts']));
    expect(renderTab('users', 'loading')).toBe('directory users, loading');
    expect(renderTab('directory', 'loading')).toBe('directory records, loading');
    expect(renderTab('local-accounts', 'loading')).toBe('local accounts');
  });

  it("is main's page where phase 2 is off", () => {
    flags.phase2 = 'off';
    expect(tabIds('off')).not.toContain('directory');
    expect(tabIds('off')).not.toContain('local-accounts');
    expect(renderTab('users', 'off')).toBe('local accounts');
  });
});
