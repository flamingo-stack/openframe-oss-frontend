/**
 * Pins how the install command carries its `x-machine-id`: a
 * fresh v4 UUID per mount that survives re-renders and selector changes,
 * rotates only when the page asks (after a copy), is never shared between two
 * mounts, and is held back on the prerender so hydration has nothing to
 * disagree about. Also pins which optional flags ride the install and the
 * register command.
 */

import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { act, useEffect } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteAccessMode } from '../types/remote-access';
import { MACHINE_ID_HEADER } from '../utils/device-command-utils';
import { useInstallCommand } from './use-install-command';

vi.mock('./use-registration-secret', () => ({
  useRegistrationSecret: () => ({ initialKey: 'secret-1', isLoading: false, error: null, refetch: vi.fn() }),
}));

const logKey = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('./use-agent-log-key', () => ({ useAgentLogKey: () => logKey.value }));

const authUser = vi.hoisted(() => ({ id: 'user-1' }));
type AuthSlice = { user: { id: string } };
vi.mock('@/stores', () => ({
  selectUser: (state: AuthSlice) => state.user,
  useAuthStore: (selector: (state: AuthSlice) => unknown) => selector({ user: authUser }),
}));

vi.mock('@/lib/platform', () => ({ isAppShell: () => false }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => '' } }));

type Result = ReturnType<typeof useInstallCommand>;
type Options = Parameters<typeof useInstallCommand>[0];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The header value as each shell's download line carries it. */
function machineIdOf(command: string, platform: OSPlatformId): string {
  const pattern =
    platform === 'windows'
      ? new RegExp(`-Headers @\\{ '${MACHINE_ID_HEADER}' = '([^']*)' \\}`)
      : new RegExp(`-H '${MACHINE_ID_HEADER}: ([^']*)'`);
  const match = command.match(pattern);
  if (!match) throw new Error(`no ${MACHINE_ID_HEADER} header in: ${command}`);
  return match[1];
}

let latest: Result | undefined;

function Probe({ platform }: { platform: OSPlatformId }) {
  const result = useInstallCommand({ organizationId: 'org-1', platform });
  useEffect(() => {
    latest = result;
  });
  return <pre>{result.command}</pre>;
}

function mount(platform: OSPlatformId): { root: Root; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Probe platform={platform} />));
  return { root, container };
}

function current(): Result {
  if (!latest) throw new Error('probe has not rendered');
  return latest;
}

let onceRoot: Root | undefined;

/** Renders the hook once for a Windows device of org-1, plus `options`; `unmountOnce` cleans up. */
function renderOnce(options: Partial<Options> = {}): Result {
  let result: Result | undefined;
  function OnceProbe() {
    const value = useInstallCommand({ organizationId: 'org-1', platform: 'windows', ...options });
    useEffect(() => {
      result = value;
    });
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  onceRoot = createRoot(container);
  act(() => onceRoot?.render(<OnceProbe />));
  if (!result) throw new Error('probe has not rendered');
  return result;
}

function unmountOnce() {
  if (onceRoot) act(() => onceRoot?.unmount());
  onceRoot = undefined;
  document.body.innerHTML = '';
}

describe('useInstallCommand machine id', () => {
  const roots: Root[] = [];

  beforeEach(() => {
    latest = undefined;
  });

  afterEach(() => {
    for (const root of roots.splice(0)) act(() => root.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('gives every platform variant a v4 uuid in the download header', () => {
    for (const platform of ['darwin', 'windows', 'linux'] as const) {
      const { root } = mount(platform);
      roots.push(root);
      expect(machineIdOf(current().command, platform)).toMatch(UUID_V4);
    }
  });

  it('keeps the id across re-renders and selector changes until the page rotates it', () => {
    const { root } = mount('darwin');
    roots.push(root);
    const first = machineIdOf(current().command, 'darwin');

    act(() => root.render(<Probe platform="darwin" />));
    expect(machineIdOf(current().command, 'darwin')).toBe(first);

    act(() => root.render(<Probe platform="windows" />));
    expect(machineIdOf(current().command, 'windows')).toBe(first);

    act(() => current().rotateMachineId());
    const rotated = machineIdOf(current().command, 'windows');
    expect(rotated).toMatch(UUID_V4);
    expect(rotated).not.toBe(first);
  });

  it('never hands two mounts the same id', () => {
    const { root: a } = mount('darwin');
    roots.push(a);
    const idA = machineIdOf(current().command, 'darwin');

    latest = undefined;
    const { root: b } = mount('darwin');
    roots.push(b);
    const idB = machineIdOf(current().command, 'darwin');

    expect(idA).not.toBe(idB);
  });

  it('prerenders with an empty id and hydrates onto it without a mismatch', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(<Probe platform="darwin" />);
    expect(machineIdOf(container.textContent ?? '', 'darwin')).toBe('');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root!: Root;
    await act(async () => {
      root = hydrateRoot(container, <Probe platform="darwin" />);
    });
    roots.push(root);

    expect(consoleError).not.toHaveBeenCalled();
    expect(machineIdOf(container.textContent ?? '', 'darwin')).toMatch(UUID_V4);
  });
});

describe('useInstallCommand remote access mode', () => {
  afterEach(unmountOnce);

  function render(remoteAccessMode: RemoteAccessMode | null): Result {
    return renderOnce({ tags: [{ key: 'env', values: ['prod'] }], remoteAccessMode });
  }

  it('puts an explicit mode after the tags in both the install and the register command', () => {
    const { command, registerCommand } = render('NOTIFY_ONLY');
    for (const line of [command, registerCommand]) {
      expect(line.endsWith(`--tag "env=prod" --remote-access-mode notify-only`)).toBe(true);
    }
  });

  it('leaves the flag out when the device follows its customer', () => {
    const { command, registerCommand } = render(null);
    for (const line of [command, registerCommand]) {
      expect(line).not.toContain('--remote-access-mode');
      expect(line.endsWith(`--tag "env=prod"`)).toBe(true);
    }
  });
});

describe('useInstallCommand log key', () => {
  afterEach(() => {
    unmountOnce();
    logKey.value = undefined;
    authUser.id = 'user-1';
  });

  it('passes the tenant log key in both the install and the register command', () => {
    logKey.value = 'log-1';
    const { command, registerCommand } = renderOnce();
    for (const line of [command, registerCommand]) {
      expect(line).toContain('--initialKey secret-1 --logKey log-1 --orgId org-1');
    }
  });

  it('leaves both commands unchanged when the tenant has no log key', () => {
    const { command, registerCommand } = renderOnce();
    for (const line of [command, registerCommand]) {
      expect(line).toContain('--initialKey secret-1 --orgId org-1');
      expect(line).not.toContain('--logKey');
    }
  });

  it('sends the desktop shell every value it has', () => {
    logKey.value = 'log-1';
    expect(renderOnce().installRequest).toEqual({
      orgId: 'org-1',
      initialKey: 'secret-1',
      logKey: 'log-1',
      userId: 'user-1',
    });
  });

  it('sends the desktop shell no empty value, since the shell refuses one', () => {
    logKey.value = '';
    authUser.id = '';
    const { installRequest } = renderOnce();
    expect(installRequest.logKey).toBeUndefined();
    expect(installRequest.userId).toBeUndefined();
  });

  it('hands out a command before the key arrives and adds the key once it does', () => {
    latest = undefined;
    const { root } = mount('darwin');
    expect(current().command).not.toContain('--logKey');

    logKey.value = 'log-1';
    act(() => root.render(<Probe platform="darwin" />));
    expect(current().command).toContain('--initialKey secret-1 --logKey log-1 --orgId org-1');
    expect(current().registerCommand).toContain('--initialKey secret-1 --logKey log-1 --orgId org-1');

    act(() => root.unmount());
  });
});
