/**
 * The deploy step waits for its own reads: while the organizations are read it
 * draws its own loading form under its heading, and the page's fallback (the
 * welcome screen, three steps back) never shows in between.
 */

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reads = vi.hoisted(() => ({
  organizations: null as Promise<void> | null,
  device: null as unknown,
}));

vi.mock('@/app/(app)/devices/hooks/use-device-organizations', () => ({
  useDeviceOrganizations: () => {
    // Suspends until the test lets the read land, the way `useSuspenseQuery` does.
    if (reads.organizations) throw reads.organizations;
    return [{ organizationId: 'org-1', isDefault: true }];
  },
}));
vi.mock('@/app/(app)/devices/hooks/use-install-command', () => ({
  useInstallCommand: () => ({ command: 'sudo ./openframe-client install', initialKey: 'key' }),
}));
vi.mock('../hooks/use-first-device-enrollment', () => ({ useFirstDeviceEnrollment: () => reads.device }));
vi.mock('../hooks/use-local-agent-install', () => ({
  useLocalAgentInstall: () => ({ supported: false, status: 'idle', lines: [], error: null, start: vi.fn() }),
}));
vi.mock('@/app/hooks/use-copy-to-clipboard', () => ({ useCopyToClipboard: () => ({ copy: vi.fn() }) }));
vi.mock('@/lib/analytics', () => ({ EVENT_SUBTYPE: { ADD_DEVICE: 'add-device' }, trackDashboardActivity: vi.fn() }));
vi.mock('@/lib/native-shell', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  canInstallAgentLocally: () => false,
}));

import { DeployDeviceStep } from './deploy-device-step';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  reads.organizations = null;
  reads.device = null;
});

/** The first device at its enrollment stages. */
function enrolledDevice(stages: { inventoryReceived: boolean; aiReady: boolean }) {
  return { machineId: 'm-1', mentionId: 'm-1', name: 'mac', online: true, stages };
}

describe('DeployDeviceStep', () => {
  it('draws its own loading form while its reads are out, not the page fallback', async () => {
    let land!: () => void;
    reads.organizations = new Promise<void>(resolve => {
      land = resolve;
    });

    act(() =>
      root.render(
        // The page's boundary: its fallback is the welcome screen.
        <Suspense fallback={<p>Agentic AI that runs your IT</p>}>
          <DeployDeviceStep organizationId={null} onEnrolled={vi.fn()} />
        </Suspense>,
      ),
    );

    expect(container.textContent).not.toContain('Agentic AI that runs your IT');
    expect(container.textContent).toContain('Deploy First Device');
    expect(container.textContent).not.toContain('openframe-client');

    reads.organizations = null;
    await act(async () => {
      land();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Deploy First Device');
    expect(container.textContent).toContain('sudo ./openframe-client install');
  });

  it('shows the stage still to come until the last one lands', () => {
    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: false });
    act(() => root.render(<DeployDeviceStep organizationId={null} onEnrolled={vi.fn()} />));
    expect(container.textContent).toContain('inventory received');
    expect(container.textContent).toContain('Waiting for the next stage');

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    act(() => root.render(<DeployDeviceStep organizationId={null} onEnrolled={vi.fn()} />));
    expect(container.textContent).toContain('mingo unlocked');
    expect(container.textContent).not.toContain('Waiting for the next stage');
  });
});
