/**
 * Pins the device page's outdated-client banner: shown only below the minimum version, with an
 * install command for the device's own customer and platform that leaves out the viewer (a
 * re-install keeps who added the device), and copied with a fresh download id each time.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../types/device.types';
import { MACHINE_ID_HEADER } from '../utils/device-command-utils';
import { OutdatedClientBanner } from './outdated-client-banner';

const { secret, toast } = vi.hoisted(() => ({
  secret: { initialKey: 'secret-1', error: null as string | null },
  toast: vi.fn<(options: Record<string, unknown>) => void>(),
}));

vi.mock('../hooks/use-registration-secret', () => ({
  useRegistrationSecret: () => ({
    initialKey: secret.initialKey,
    isLoading: false,
    error: secret.error,
    refetch: vi.fn(),
  }),
}));
vi.mock('../hooks/use-agent-log-key', () => ({ useAgentLogKey: () => undefined }));

type AuthSlice = { user: { id: string } };
vi.mock('@/stores', () => ({
  selectUser: (state: AuthSlice) => state.user,
  useAuthStore: (selector: (state: AuthSlice) => unknown) => selector({ user: { id: 'viewer-1' } }),
}));
vi.mock('@/lib/platform', () => ({ isAppShell: () => false }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => '' } }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

function device(overrides: Partial<Device>): Device {
  return {
    id: 'node-1',
    machineId: 'm-1',
    hostname: 'workstation-23',
    nickname: null,
    organizationId: 'org-7',
    osType: 'WINDOWS',
    agentVersion: '1.5.2',
    ...overrides,
  } as Device;
}

let root: Root | undefined;
let container: HTMLElement;
const writeText = vi.fn<(text: string) => Promise<void>>();

function render(value: Device) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<OutdatedClientBanner device={value} />));
}

/** The command as the box draws it: the element whose own text is the whole command. */
function shownCommand(): string {
  const box = [...container.querySelectorAll('*')].find(
    el => el.childElementCount === 0 && /^(Set-Location|cd ~)/.test(el.textContent ?? ''),
  );
  if (!box?.textContent) throw new Error(`no install command in: ${container.textContent}`);
  return box.textContent;
}

function machineIdOf(command: string): string {
  const match = command.match(new RegExp(`'${MACHINE_ID_HEADER}' = '([^']*)'`));
  if (!match) throw new Error(`no ${MACHINE_ID_HEADER} header in: ${command}`);
  return match[1];
}

function copyButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Copy Install Command'));
  if (!button) throw new Error('no Copy Install Command button');
  return button;
}

/** The copy icon in the command box's corner. */
function boxCopyButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Copy installation script"]');
  if (!button) throw new Error('no copy button in the command box');
  return button;
}

beforeEach(() => {
  secret.initialKey = 'secret-1';
  secret.error = null;
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('OutdatedClientBanner', () => {
  it("shows the banner and an install command for the device's customer, without the viewer", () => {
    render(device({}));
    expect(container.textContent).toContain('OpenFrame client is outdated');
    expect(container.textContent).toContain('OpenFrame Installation Script');
    const command = shownCommand();
    expect(command).toContain("& '.\\openframe-client.exe' install");
    expect(command).toContain('--initialKey secret-1 --orgId org-7');
    expect(command).not.toContain('--userId');
    expect(command).not.toContain('--tag');
  });

  it('builds the macOS command for a Mac', () => {
    render(device({ osType: 'MAC_OS' }));
    expect(shownCommand()).toContain('sudo ./openframe-client install');
  });

  it('renders nothing for a current client, an unknown version, a device without a customer or an archive record', () => {
    for (const value of [
      ...['ARCHIVED', 'DELETED', 'PENDING_DELETION', 'DECOMMISSIONED'].map(status => device({ status })),
      device({ agentVersion: '1.6.0' }),
      device({
        agentVersion: '1.5.2',
        installedAgents: [
          { id: 'a', machineId: 'm-1', agentType: 'openframe-client', version: '1.6.10', createdAt: '', updatedAt: '' },
        ],
      }),
      device({ agentVersion: undefined }),
      device({ organizationId: undefined }),
    ]) {
      render(value);
      expect(container.innerHTML).toBe('');
      act(() => root?.unmount());
      root = undefined;
    }
  });

  it.each([
    ['the Copy Install Command button', copyButton],
    ["the command box's copy icon", boxCopyButton],
  ])('%s copies the command on screen, then shows a fresh download id', async (_, button) => {
    render(device({}));
    const before = shownCommand();
    await act(async () => button().click());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(before);
    expect(machineIdOf(shownCommand())).not.toBe(machineIdOf(before));
  });

  it("refuses the command box's copy icon before the install key arrives", async () => {
    secret.initialKey = '';
    secret.error = 'Request failed with status 503';
    render(device({}));
    await act(async () => boxCopyButton().click());
    expect(writeText).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Registration secret could not be loaded' }),
    );
  });

  it('draws the box as loading and refuses to copy before the install key arrives', async () => {
    secret.initialKey = '';
    render(device({}));
    expect(() => shownCommand()).toThrow();
    await act(async () => copyButton().click());
    expect(writeText).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Secret unavailable', description: 'Registration secret not loaded yet' }),
    );
  });

  it('stops loading when the install key fails to load, and says so on copy', async () => {
    secret.initialKey = '';
    secret.error = 'Request failed with status 503';
    render(device({}));
    expect(shownCommand()).toContain('install --serverUrl');
    await act(async () => copyButton().click());
    expect(writeText).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Registration secret could not be loaded' }),
    );
  });
});
