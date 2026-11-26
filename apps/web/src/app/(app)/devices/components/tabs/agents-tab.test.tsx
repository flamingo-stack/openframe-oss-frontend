/**
 * Every agent the platform installs keeps a card on the Agents tab from the moment the device
 * registers: one that has not reported yet reads PENDING instead of being absent, and the slot
 * turns into the live card once its installed-agent / tool-connection row lands.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { EMPTY_VALUE } from '@/lib/empty-value';
import type { Instant } from '@/lib/graphql-scalars';
import type { DevicePackageManager } from '../../hooks/device-package-managers';
import type { Device, InstalledAgent, ToolConnection, ToolType } from '../../types/device.types';
import { AgentsTab, packageManagerCardData } from './agents-tab';

const appMode = vi.hoisted(() => ({ isSaasTenantMode: vi.fn(() => false) }));

vi.mock('@/lib/app-mode', () => ({ isSaasTenantMode: appMode.isSaasTenantMode }));

// The package managers are the tab's own query: each test sets what it answered (undefined = not read yet).
const packageManagers = vi.hoisted(() => ({ data: undefined as DevicePackageManager[] | null | undefined }));

vi.mock('../../hooks/device-package-managers', () => ({
  useDevicePackageManagers: () => ({ data: packageManagers.data }),
}));

// The lib measures text for truncation tooltips; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

function device(overrides: Partial<Device>): Device {
  return { id: 'd-1', machineId: 'm-1', hostname: 'host', status: 'ONLINE', ...overrides } as Device;
}

function agent(agentType: string, version = '1.0.0'): InstalledAgent {
  return { agentType, version } as InstalledAgent;
}

function connection(toolType: ToolType, overrides: Partial<ToolConnection> = {}): ToolConnection {
  return {
    id: `tc-${toolType}`,
    machineId: 'm-1',
    toolType,
    agentToolId: `${toolType}-id`,
    status: 'online',
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function render(target: Device) {
  act(() => {
    root.render(<AgentsTab device={target} />);
  });
}

/** Text of each agent card, in render order. */
function cards(): string[] {
  const grid = container.querySelector('section > div');
  return Array.from(grid?.children ?? []).map(card => card.textContent ?? '');
}

function pendingCount(): number {
  return cards().filter(text => /pending/i.test(text)).length;
}

beforeEach(() => {
  appMode.isSaasTenantMode.mockReturnValue(false);
  packageManagers.data = undefined;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AgentsTab placeholders', () => {
  it('shows a pending card per expected agent on a device that has reported nothing yet', () => {
    render(device({ installedAgents: [], toolConnections: [] }));

    expect(container.textContent).not.toContain('No agents found');
    expect(cards()).toHaveLength(2);
    expect(pendingCount()).toBe(2);
  });

  it('adds the chat app slot on SaaS tenants', () => {
    appMode.isSaasTenantMode.mockReturnValue(true);
    render(device({ installedAgents: [], toolConnections: [] }));

    expect(cards()).toHaveLength(3);
    expect(pendingCount()).toBe(3);
  });

  it('keeps the MeshCentral slot pending while Fleet has already connected', () => {
    render(
      device({
        installedAgents: [agent('fleetmdm-agent', '4.70.0')],
        toolConnections: [connection('FLEET_MDM')],
      }),
    );

    const [fleet, mesh] = cards();
    expect(fleet).toContain('4.70.0');
    expect(fleet).not.toMatch(/pending/i);
    expect(mesh).toMatch(/pending/i);
    expect(mesh).not.toContain('Version');
  });

  it('replaces every slot with the reported agent once all are in', () => {
    appMode.isSaasTenantMode.mockReturnValue(true);
    render(
      device({
        installedAgents: [agent('fleetmdm-agent'), agent('meshcentral-agent'), agent('openframe-chat')],
        toolConnections: [connection('FLEET_MDM'), connection('MESHCENTRAL')],
      }),
    );

    expect(cards()).toHaveLength(3);
    expect(pendingCount()).toBe(0);
  });

  it('does not duplicate a slot for an agent known only by its tool connection', () => {
    render(device({ installedAgents: [], toolConnections: [connection('MESHCENTRAL')] }));

    expect(cards()).toHaveLength(2);
    expect(pendingCount()).toBe(1);
  });

  it('keeps no slots on archived devices', () => {
    render(device({ status: 'ARCHIVED', installedAgents: [], toolConnections: [] }));

    expect(container.textContent).toContain('No agents found');
  });
});

describe('AgentsTab on an OS below the Fleet minimum', () => {
  const fleetUnsupported = [{ toolType: 'FLEET_MDM', minOsVersion: '13.0', osVersion: '11.7.10' }];

  it('shows the Fleet slot as Not supported, not Pending, while MeshCentral stays pending', () => {
    render(device({ installedAgents: [], toolConnections: [], unsupportedTools: fleetUnsupported }));

    const [fleet, mesh] = cards();
    expect(fleet).toContain('NOT SUPPORTED');
    expect(fleet).not.toMatch(/pending/i);
    expect(mesh).toMatch(/pending/i);
  });

  it('marks an installed Fleet and the osquery it bundles Not supported, even with a live connection', () => {
    render(
      device({
        installedAgents: [agent('fleetmdm-agent', '4.70.0'), agent('osqueryd', '5.12.0'), agent('meshcentral-agent')],
        toolConnections: [connection('FLEET_MDM'), connection('MESHCENTRAL')],
        unsupportedTools: fleetUnsupported,
      }),
    );

    const [fleet, mesh, osquery] = cards();
    expect(fleet).toContain('NOT SUPPORTED');
    expect(fleet).toContain('4.70.0');
    expect(osquery).toContain('NOT SUPPORTED');
    expect(mesh).toContain('ONLINE');
    expect(mesh).not.toContain('NOT SUPPORTED');
  });

  it('changes nothing when no tool is unsupported', () => {
    render(device({ installedAgents: [], toolConnections: [], unsupportedTools: [] }));

    expect(pendingCount()).toBe(2);
    expect(container.textContent).not.toContain('NOT SUPPORTED');
  });
});

function manager(overrides: Partial<DevicePackageManager>): DevicePackageManager {
  return {
    type: 'WINGET',
    state: 'PRESENT',
    managed: true,
    installing: false,
    version: '1.12.470',
    versionChangedAt: new Date(Date.now() - 4 * 24 * 3_600_000).toISOString() as Instant,
    ...overrides,
  };
}

/** Each section's heading and the text of its cards, in render order. */
function sections(): Array<{ title: string; cards: string[] }> {
  return Array.from(container.querySelectorAll('section')).map(section => ({
    title: section.querySelector('h3')?.textContent ?? '',
    cards: Array.from(section.querySelector('div')?.children ?? []).map(card => card.textContent ?? ''),
  }));
}

const windowsAgents = {
  installedAgents: [agent('fleetmdm-agent'), agent('meshcentral-agent')],
  toolConnections: [connection('FLEET_MDM'), connection('MESHCENTRAL')],
};

describe('AgentsTab package managers', () => {
  it('heads the agents Agents, with no Agent Versions heading left', () => {
    render(device(windowsAgents));

    expect(sections().map(section => section.title)).toEqual(['Agents']);
    expect(container.textContent).not.toContain('Agent Versions');
  });

  it('draws Chocolatey then WinGet under Package Managers, with Version and Updated and no Status', () => {
    packageManagers.data = [
      manager({ type: 'WINGET' }),
      manager({
        type: 'CHOCO',
        version: '2.7.5',
        versionChangedAt: new Date(Date.now() - 21 * 24 * 3_600_000).toISOString() as Instant,
      }),
    ];
    render(device(windowsAgents));

    const [agents, managers] = sections();
    expect(agents.title).toBe('Agents');
    expect(managers.title).toBe('Package Managers');
    const [choco, winget] = managers.cards;
    expect(choco).toContain('Chocolatey');
    expect(choco).toContain('2.7.5');
    expect(choco).toContain('Updated');
    expect(choco).not.toContain('Status');
    expect(choco).not.toContain('Signed by Flamingo');
    expect(winget).toContain('WinGet');
    expect(winget).toContain('1.12.470');
  });

  it('shows Homebrew on a Mac', () => {
    packageManagers.data = [
      manager({ type: 'BREW', version: '5.1.3' }),
      manager({ type: 'WINGET', state: 'UNSUPPORTED', managed: false, version: null }),
    ];
    render(device(windowsAgents));

    expect(sections()[1].cards).toEqual([expect.stringContaining('Homebrew')]);
  });

  it('shows PENDING without Version or Updated while OpenFrame installs a manager', () => {
    packageManagers.data = [manager({ type: 'CHOCO', state: 'MISSING', installing: true, version: null })];
    render(device(windowsAgents));

    const [card] = sections()[1].cards;
    expect(card).toContain('PENDING');
    expect(card).not.toContain('Version');
    expect(card).not.toContain('Updated');
  });

  it('hides the Updated row while the change time is unknown', () => {
    packageManagers.data = [manager({ versionChangedAt: null })];
    render(device(windowsAgents));

    const [card] = sections()[1].cards;
    expect(card).toContain('1.12.470');
    expect(card).not.toContain('Updated');
  });

  it('shows the empty mark as the Version of an installed manager reported without one', () => {
    packageManagers.data = [manager({ type: 'CHOCO', version: null, versionChangedAt: null })];
    render(device(windowsAgents));

    const [card] = sections()[1].cards;
    expect(card).toContain('Chocolatey');
    expect(card).toContain(`Version${EMPTY_VALUE}`);
    expect(card).not.toContain('Updated');
  });

  it('draws no section when no manager gets a card, or the backend has no such field', () => {
    packageManagers.data = [manager({ managed: false }), manager({ type: 'CHOCO', state: 'MISSING' })];
    render(device(windowsAgents));
    expect(sections()).toHaveLength(1);

    packageManagers.data = null;
    render(device(windowsAgents));
    expect(container.textContent).not.toContain('Package Managers');
  });

  it('shows the managers, not the empty state, on a device with managers and no agents', () => {
    packageManagers.data = [manager({})];
    render(device({ status: 'ARCHIVED', installedAgents: [], toolConnections: [] }));

    expect(container.textContent).not.toContain('No agents found');
    expect(sections().map(section => section.title)).toEqual(['Package Managers']);
  });

  it('shows the empty state only when there are neither agents nor managers', () => {
    packageManagers.data = [];
    render(device({ status: 'ARCHIVED', installedAgents: [], toolConnections: [] }));

    expect(container.textContent).toContain('No agents found');
  });
});

describe('packageManagerCardData', () => {
  const rowLabels = (card: Parameters<typeof packageManagerCardData>[0]) =>
    packageManagerCardData(card).items.map(item => item.label);
  const base = {
    type: 'CHOCO' as const,
    label: 'Chocolatey',
    pending: false,
    version: '2.7.5',
    versionChangedAt: new Date(Date.now() - 3 * 24 * 3_600_000).toISOString() as Instant,
  };

  it('gives an installed manager Agent, Version and Updated, and no footer', () => {
    const data = packageManagerCardData(base);

    expect(data.items.map(item => item.label)).toEqual(['Agent', 'Version', 'Updated']);
    expect(data.items[1].value).toBe('2.7.5');
    expect(data.items[2].value).toBe('3d ago');
    expect(data.footer).toBeUndefined();
  });

  it('gives a pending manager Agent and Status only', () => {
    expect(rowLabels({ ...base, pending: true, version: null, versionChangedAt: null })).toEqual(['Agent', 'Status']);
  });

  it('keeps the Version row with the empty mark and drops Updated when neither was reported', () => {
    const data = packageManagerCardData({ ...base, version: null, versionChangedAt: null });

    expect(data.items.map(item => item.label)).toEqual(['Agent', 'Version']);
    expect((data.items[1].value as unknown as ReactElement).type).toBe(EmptyValue);
  });

  it('drops Updated for a change time it cannot read', () => {
    expect(rowLabels({ ...base, versionChangedAt: 'not a date' as Instant })).toEqual(['Agent', 'Version']);
  });
});
