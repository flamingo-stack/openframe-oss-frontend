/**
 * The deploy step: it waits for its own reads behind its own boundary (the
 * page's fallback, the welcome screen, never shows in between); "Deploy on this
 * Device" is the desktop shell's alone; and nothing moves on by itself - an
 * install hands over to "Continue", live once the assistant is up.
 */

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reads = vi.hoisted(() => ({
  organizations: null as Promise<void> | null,
  device: null as unknown,
  local: { supported: false, status: 'idle' as string },
}));

vi.mock('@/app/(app)/devices/hooks/use-device-organizations', () => ({
  useDeviceOrganizations: () => {
    // Suspends until the test lets the read land, the way `useSuspenseQuery` does.
    if (reads.organizations) throw reads.organizations;
    return [{ organizationId: 'org-1', isDefault: true }];
  },
}));
vi.mock('@/app/(app)/devices/hooks/use-install-command', () => ({
  useInstallCommand: () => ({
    command: 'sudo ./openframe-client install',
    initialKey: 'key',
    installRequest: { orgId: 'org', initialKey: 'key' },
  }),
}));
vi.mock('../hooks/use-first-device-enrollment', () => ({ useFirstDeviceEnrollment: () => reads.device }));
vi.mock('../hooks/use-local-agent-install', () => ({
  useLocalAgentInstall: () => ({ ...reads.local, lines: [], error: null, start: vi.fn() }),
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
const onContinue = vi.fn();

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
  reads.local = { supported: false, status: 'idle' };
  onContinue.mockReset();
});

/** The first device at its enrollment stages. */
function enrolledDevice(stages: { inventoryReceived: boolean; aiReady: boolean }) {
  return { machineId: 'm-1', mentionId: 'm-1', name: 'mac', online: true, stages };
}

function renderStep(persisting = false) {
  act(() => root.render(<DeployDeviceStep organizationId={null} onContinue={onContinue} persisting={persisting} />));
}

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === label);

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
          <DeployDeviceStep organizationId={null} onContinue={onContinue} persisting={false} />
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
    renderStep();
    expect(container.textContent).toContain('inventory received');
    expect(container.textContent).toContain('Waiting for the next stage');

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    renderStep();
    expect(container.textContent).toContain('mingo unlocked');
    expect(container.textContent).not.toContain('Waiting for the next stage');
  });

  it('offers Deploy on this Device in the desktop shell alone', () => {
    renderStep();
    expect(button('Deploy on this Device')).toBeUndefined();
    expect(button('Copy Command')).toBeDefined();

    reads.local = { supported: true, status: 'idle' };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(false);
  });

  it('locks Deploy while it runs, offers it again after a failure, and hands over to Continue after an install', () => {
    reads.local = { supported: true, status: 'running' };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(true);

    reads.local = { supported: true, status: 'failed' };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(false);
    expect(button('Continue')).toBeUndefined();

    // Installed, the assistant not up yet: Continue waits.
    reads.local = { supported: true, status: 'succeeded' };
    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: false });
    renderStep();
    expect(button('Deploy on this Device')).toBeUndefined();
    expect(button('Continue')?.disabled).toBe(true);

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    renderStep();
    expect(button('Continue')?.disabled).toBe(false);
  });

  it('never moves on by itself: Continue does, with the enrolled device', () => {
    vi.useFakeTimers();
    try {
      reads.local = { supported: true, status: 'succeeded' };
      reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
      renderStep();
      act(() => vi.advanceTimersByTime(10_000));
      expect(onContinue).not.toHaveBeenCalled();

      act(() => button('Continue')?.click());
      expect(onContinue).toHaveBeenCalledWith(reads.device);
    } finally {
      vi.useRealTimers();
    }
  });

  it('joins Copy Command with Continue on the web once the device is up', () => {
    renderStep();
    expect(button('Continue')).toBeUndefined();

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    renderStep();
    expect(button('Copy Command')).toBeDefined();
    expect(button('Continue')?.disabled).toBe(false);
  });

  it('holds Continue while the step is being persisted', () => {
    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    renderStep(true);
    expect(button('Continue')?.disabled).toBe(true);
  });
});
