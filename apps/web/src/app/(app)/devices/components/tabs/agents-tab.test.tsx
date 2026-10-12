/**
 * Every agent the platform installs keeps a card on the Agents tab from the moment the device
 * registers: one that has not reported yet reads PENDING instead of being absent, and the slot
 * turns into the live card once its installed-agent / tool-connection row lands.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device, InstalledAgent, ToolConnection, ToolType } from '../../types/device.types';
import { AgentsTab } from './agents-tab';

const appMode = vi.hoisted(() => ({ isSaasTenantMode: vi.fn(() => false) }));

vi.mock('@/lib/app-mode', () => ({ isSaasTenantMode: appMode.isSaasTenantMode }));

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
