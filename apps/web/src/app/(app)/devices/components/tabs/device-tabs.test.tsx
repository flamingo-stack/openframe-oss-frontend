/**
 * The Users tab swaps the machine's local accounts for directory users only where the tenant has a directory. A tenant
 * without one must keep its local accounts: "No users yet" there would hide accounts the machine really has.
 */

import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';

vi.mock('../../hooks/use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => 'on' }));
vi.mock('@/app/(app)/incidents/hooks/use-incidents-gate', () => ({ useIncidentsGate: () => 'on' }));

// The tabs are stand-ins: what is under test is which one each gate value picks, and the real ones need Relay.
vi.mock('./users-tab', () => ({ UsersTab: () => <div>local accounts</div> }));
vi.mock('./directory-users-tab', () => ({ DirectoryUsersTab: () => <div>directory users</div> }));
vi.mock('./directory-tab', () => ({ DirectoryTab: () => <div>directory records</div> }));
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

  it('keeps the Directory tab in place while the gate is read, so a link to it survives', () => {
    expect(tabIds('loading')).toContain('directory');
    expect(renderTab('users', 'loading')).not.toContain('local accounts');
  });
});
