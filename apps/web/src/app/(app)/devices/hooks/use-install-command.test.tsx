/**
 * Pins how the install command carries its `x-machine-id`: a
 * fresh v4 UUID per mount that survives re-renders and selector changes,
 * rotates only when the page asks (after a copy), is never shared between two
 * mounts, and is held back on the prerender so hydration has nothing to
 * disagree about.
 */

import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { act, useEffect } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MACHINE_ID_HEADER } from '../utils/device-command-utils';
import { useInstallCommand } from './use-install-command';

vi.mock('./use-registration-secret', () => ({
  useRegistrationSecret: () => ({ initialKey: 'secret-1', isLoading: false, error: null, refetch: vi.fn() }),
}));

type AuthSlice = { user: { id: string } };
vi.mock('@/stores', () => ({
  selectUser: (state: AuthSlice) => state.user,
  useAuthStore: (selector: (state: AuthSlice) => unknown) => selector({ user: { id: 'user-1' } }),
}));

vi.mock('@/lib/platform', () => ({ isAppShell: () => false }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => '' } }));

type Result = ReturnType<typeof useInstallCommand>;
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
