/**
 * The deploy step: it waits for its own reads behind its own boundary (the
 * page's fallback, the welcome screen, never shows in between); "Deploy on this
 * Device" is the desktop shell's alone; nothing moves on by itself - an
 * install hands over to "Continue", live once the assistant is up; and an
 * agent that does not reach the platform in time gets a troubleshooting notice
 * beside the wait, not instead of it.
 */

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reads = vi.hoisted(() => ({
  organizations: null as Promise<void> | null,
  device: null as unknown,
  local: { supported: false, status: 'idle' as string, settledAt: null as number | null },
  copy: vi.fn(),
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
vi.mock('@/app/hooks/use-copy-to-clipboard', () => ({ useCopyToClipboard: () => ({ copy: reads.copy }) }));
vi.mock('@/lib/analytics', () => ({ EVENT_SUBTYPE: { ADD_DEVICE: 'add-device' }, trackDashboardActivity: vi.fn() }));
vi.mock('@/app/components/shared/contact-support-modal', () => ({
  ContactSupportModal: ({ open }: { open: boolean }) => (open ? <div>Contact support modal</div> : null),
}));
vi.mock('@/lib/native-shell', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  canInstallAgentLocally: () => false,
}));

import { AGENT_CONNECT_TIMEOUT_MS, DeployDeviceStep } from './deploy-device-step';

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
  reads.local = { supported: false, status: 'idle', settledAt: null };
  onContinue.mockReset();
  reads.copy.mockReset();
  vi.useRealTimers();
});

/** The first device at its enrollment stages; registered now unless said otherwise. */
function enrolledDevice(
  stages: { connected?: boolean; inventoryReceived: boolean; aiReady: boolean },
  registeredAt: number | null = Date.now(),
) {
  const connected = stages.connected ?? stages.aiReady;
  return {
    machineId: 'm-1',
    mentionId: 'm-1',
    name: 'mac',
    online: connected,
    registeredAt,
    stages: { enrolled: true, ...stages, connected },
  };
}

const NOT_CONNECTED = "Your device hasn't connected yet";
const WINDOWS_LOGS = 'C:\\ProgramData\\OpenFrame\\logs';
const MAC_LOGS = '/Library/Logs/OpenFrame';
const HINT_LONGER = 'This is taking longer than usual';

/** Moves the clock and lets the step's deadline tick see it. */
function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
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

  it('shows a labelled waiting row until the last stage lands, in the design wording', () => {
    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: false });
    renderStep();
    expect(container.textContent).toContain('Workspace found');
    expect(container.textContent).toContain('Device registered');
    expect(container.textContent).toContain('Inventory received');
    expect(container.textContent).toContain('Waiting for device to connect');

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true });
    renderStep();
    expect(container.textContent).toContain('Mingo unlocked');
    expect(container.textContent).not.toContain('Waiting for device to connect');
  });

  it('shows the waiting row after a reload with a registered device that has not connected', () => {
    // No copy in this mount: the registered device alone fills the checklist.
    reads.device = enrolledDevice({ inventoryReceived: false, aiReady: false });
    renderStep();
    expect(container.textContent).toContain('Waiting for device to connect');
  });

  it('shows the notice once the agent has not connected within the timeout of registration', () => {
    vi.useFakeTimers();
    reads.device = enrolledDevice({ inventoryReceived: false, aiReady: false });
    renderStep();
    expect(container.textContent).not.toContain(NOT_CONNECTED);
    expect(container.textContent).toContain('Deployment may take 2-3 minutes');

    advance(AGENT_CONNECT_TIMEOUT_MS - 10_000);
    expect(container.textContent).not.toContain(NOT_CONNECTED);

    advance(10_000);
    expect(container.textContent).toContain(NOT_CONNECTED);
    expect(container.textContent).toContain(HINT_LONGER);
    expect(container.textContent).not.toContain('Deployment may take 2-3 minutes');
    // The wait goes on beside the notice.
    expect(container.textContent).toContain('Waiting for device to connect');
  });

  it('shows the notice at once for a registered device already past the timeout', () => {
    reads.device = enrolledDevice(
      { inventoryReceived: false, aiReady: false },
      Date.now() - AGENT_CONNECT_TIMEOUT_MS - 1_000,
    );
    renderStep();
    expect(container.textContent).toContain(NOT_CONNECTED);
  });

  it('names the logs folder of the selected OS, and follows the tab', () => {
    reads.device = enrolledDevice({ inventoryReceived: false, aiReady: false }, 0);
    renderStep();
    expect(container.textContent).toContain('zip it and attach to your support request');
    expect(container.textContent).toContain(WINDOWS_LOGS);

    const macTab = [...container.querySelectorAll('button')].find(element => /mac/i.test(element.textContent ?? ''));
    act(() => macTab?.click());
    expect(container.textContent).toContain(MAC_LOGS);
    expect(container.textContent).not.toContain(WINDOWS_LOGS);

    act(() => container.querySelector<HTMLButtonElement>(`button[aria-label="Copy ${MAC_LOGS}"]`)?.click());
    expect(reads.copy).toHaveBeenCalledWith(MAC_LOGS);
  });

  it('opens Contact Support from the notice', () => {
    reads.device = enrolledDevice({ inventoryReceived: false, aiReady: false }, 0);
    renderStep();
    expect(container.textContent).not.toContain('Contact support modal');
    act(() => button('Contact Support')?.click());
    expect(container.textContent).toContain('Contact support modal');
  });

  it('drops the notice when the agent connects late, and goes on as before', () => {
    reads.device = enrolledDevice({ inventoryReceived: false, aiReady: false }, 0);
    renderStep();
    expect(container.textContent).toContain(NOT_CONNECTED);

    // Connected, Fleet still on its way: not "hasn't connected" any more, still waiting.
    reads.device = enrolledDevice({ connected: true, inventoryReceived: false, aiReady: false }, 0);
    renderStep();
    expect(container.textContent).not.toContain(NOT_CONNECTED);
    expect(container.textContent).toContain('Deployment may take 2-3 minutes');

    reads.device = enrolledDevice({ inventoryReceived: true, aiReady: true }, 0);
    renderStep();
    expect(container.textContent).not.toContain(NOT_CONNECTED);
    expect(container.textContent).toContain('Mingo unlocked');
    expect(button('Continue')?.disabled).toBe(false);
  });

  it('times a device that never registers from the first copy of the command', () => {
    vi.useFakeTimers();
    renderStep();
    act(() => button('Copy Command')?.click());
    advance(AGENT_CONNECT_TIMEOUT_MS / 2);
    // A second copy does not restart the wait.
    act(() => button('Copy Command')?.click());
    advance(AGENT_CONNECT_TIMEOUT_MS / 2);
    expect(container.textContent).toContain(NOT_CONNECTED);
  });

  it('starts no wait for a local install that failed, and times one that went through', () => {
    vi.useFakeTimers();
    reads.local = { supported: true, status: 'failed', settledAt: Date.now() };
    renderStep();
    advance(AGENT_CONNECT_TIMEOUT_MS + 10_000);
    expect(container.textContent).not.toContain(NOT_CONNECTED);

    reads.local = { supported: true, status: 'succeeded', settledAt: Date.now() };
    renderStep();
    advance(AGENT_CONNECT_TIMEOUT_MS - 10_000);
    expect(container.textContent).not.toContain(NOT_CONNECTED);
    advance(10_000);
    expect(container.textContent).toContain(NOT_CONNECTED);
  });

  it('offers Deploy on this Device in the desktop shell alone', () => {
    renderStep();
    expect(button('Deploy on this Device')).toBeUndefined();
    expect(button('Copy Command')).toBeDefined();

    reads.local = { supported: true, status: 'idle', settledAt: null };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(false);
  });

  it('locks Deploy while it runs, offers it again after a failure, and hands over to Continue after an install', () => {
    reads.local = { supported: true, status: 'running', settledAt: null };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(true);

    reads.local = { supported: true, status: 'failed', settledAt: 0 };
    renderStep();
    expect(button('Deploy on this Device')?.disabled).toBe(false);
    expect(button('Continue')).toBeUndefined();

    // Installed, the assistant not up yet: Continue waits.
    reads.local = { supported: true, status: 'succeeded', settledAt: Date.now() };
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
      reads.local = { supported: true, status: 'succeeded', settledAt: Date.now() };
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
