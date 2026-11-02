/**
 * The desktop "Open the app" link as page startup: the initializer subscribes to the shell's
 * arrival signal, takes the download id the shell holds, and stores it for the signup. What the
 * shell holds and how the signup sends it are tested on their own sides; verified here is the seam.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({
  desktop: true,
  calls: [] as string[],
  pending: [] as (string | null)[],
  signal: null as (() => void) | null,
  listenFails: false,
  store: vi.fn<(id: string) => void>(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/client-identity', () => ({ primeShellVersion: vi.fn() }));
vi.mock('@/lib/keyboard-inset', () => ({ initKeyboardInset: vi.fn() }));
vi.mock('@/lib/native-back', () => ({ initNativeBack: vi.fn() }));
vi.mock('@/lib/token-store', () => ({ initTokenStore: () => Promise.resolve() }));
vi.mock('./notifications/notification-navigation', () => ({ resolveNatsNotificationRoute: () => null }));
vi.mock('@/lib/platform', () => ({
  isAppShell: () => shell.desktop,
  isDesktopShell: () => shell.desktop,
  isMobileShell: () => false,
  shellKind: () => (shell.desktop ? 'desktop' : 'web'),
}));
vi.mock('@/lib/registration-attribution', () => ({ storeDownloadId: shell.store }));
vi.mock('@/lib/native-shell', () => ({
  hideSplashScreen: () => Promise.resolve(),
  initNativeChrome: () => Promise.resolve(),
  // No notification transport, so the notification half stops before it takes anything.
  onNativeNotificationClick: () => Promise.resolve(false),
  takeNativeStartupNotificationClick: () => Promise.resolve(null),
  onDesktopDownloadLink: (callback: () => void) => {
    shell.calls.push('listen');
    if (shell.listenFails) return Promise.reject(new Error('no event transport'));
    shell.signal = callback;
    return Promise.resolve(true);
  },
  takeDesktopDownloadId: () => {
    shell.calls.push('take');
    return Promise.resolve(shell.pending.shift() ?? null);
  },
}));

let container: HTMLDivElement;
let root: Root;

/** A fresh module per test: the initializer runs its shell setup once per page, held at module scope. */
async function mount() {
  const { NativeShellInitializer } = await import('./native-shell-initializer');
  await act(async () => root.render(<NativeShellInitializer />));
}

beforeEach(() => {
  vi.resetModules();
  shell.desktop = true;
  shell.calls = [];
  shell.pending = [];
  shell.signal = null;
  shell.listenFails = false;
  shell.store.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the "Open the app" download id', () => {
  it('is taken after the arrival signal is subscribed, and stored', async () => {
    shell.pending = ['0f8fad5b-d9cb-469f-a165-70867728950e'];
    await mount();
    await vi.waitFor(() => expect(shell.store).toHaveBeenCalledWith('0f8fad5b-d9cb-469f-a165-70867728950e'));
    expect(shell.calls).toEqual(['listen', 'take']);
  });

  it('is taken again when a link arrives while the page is open', async () => {
    await mount();
    await vi.waitFor(() => expect(shell.calls).toEqual(['listen', 'take']));
    expect(shell.store).not.toHaveBeenCalled();

    shell.pending = ['11111111-2222-4333-8444-555555555555'];
    await act(async () => shell.signal?.());
    await vi.waitFor(() => expect(shell.store).toHaveBeenCalledWith('11111111-2222-4333-8444-555555555555'));
  });

  it('is still taken when the signal cannot be subscribed', async () => {
    shell.listenFails = true;
    shell.pending = ['0f8fad5b-d9cb-469f-a165-70867728950e'];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await vi.waitFor(() => expect(shell.store).toHaveBeenCalledWith('0f8fad5b-d9cb-469f-a165-70867728950e'));
  });

  it('is left alone outside the desktop shell', async () => {
    shell.desktop = false;
    await mount();
    expect(shell.calls).toEqual([]);
  });
});
