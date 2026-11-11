/**
 * The desktop shell's two page-startup seams. The "Open the app" link: the initializer subscribes
 * to the shell's arrival signal, takes the download id the shell holds, and stores it for the
 * signup. An OS notification click: the initializer follows the payload the shell forwards, the
 * click that started the app included. What the shell holds and how the signup sends it are tested
 * on their own sides; verified here is the seam.
 *
 * And the mobile shell's one: the report that this bundle booted, which its over-the-air updater
 * waits for, goes out after the synchronous shell setup and before the tokens are hydrated.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({
  desktop: true,
  mobile: false,
  boot: [] as string[],
  backFails: false,
  calls: [] as string[],
  pending: [] as (string | null)[],
  signal: null as (() => void) | null,
  listenFails: false,
  store: vi.fn<(id: string) => void>(),
  clickTransport: false,
  click: null as ((payload: unknown) => void) | null,
  startupClick: null as unknown,
  push: vi.fn<(route: string) => void>(),
  markRead: vi.fn<(id: string) => void>(),
  tenantHost: '',
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: shell.push }) }));
vi.mock('@/graphql/notifications/mark-notification-read-mutation', () => ({
  markNotificationReadById: shell.markRead,
}));
vi.mock('@/lib/client-identity', () => ({ primeShellVersion: vi.fn() }));
vi.mock('@/lib/keyboard-inset', () => ({ initKeyboardInset: vi.fn() }));
vi.mock('@/lib/native-back', () => ({
  initNativeBack: () => {
    if (shell.backFails) throw new Error('no back bridge');
    shell.boot.push('hardware back');
  },
}));
vi.mock('@/lib/token-store', () => ({
  initTokenStore: () => {
    shell.boot.push('hydrate tokens');
    return Promise.resolve();
  },
}));
vi.mock('@/lib/native-update', () => ({
  confirmBundleBooted: () => {
    shell.boot.push('confirm bundle');
    return Promise.resolve();
  },
}));
// The tenant host decides whether an announcement's link is a page of the app.
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => shell.tenantHost } }));
vi.mock('@/lib/platform', () => ({
  isAppShell: () => shell.desktop || shell.mobile,
  isDesktopShell: () => shell.desktop,
  isMobileShell: () => shell.mobile,
  shellKind: () => (shell.desktop ? 'desktop' : shell.mobile ? 'mobile' : 'web'),
}));
vi.mock('@/lib/registration-attribution', () => ({ storeDownloadId: shell.store }));
vi.mock('@/lib/native-shell', () => ({
  hideSplashScreen: () => Promise.resolve(),
  initNativeChrome: () => {
    shell.boot.push('native chrome');
    return Promise.resolve();
  },
  // Without a transport the notification half stops before it takes anything.
  onNativeNotificationClick: (callback: (payload: unknown) => void) => {
    if (!shell.clickTransport) return Promise.resolve(false);
    shell.click = callback;
    return Promise.resolve(true);
  },
  takeNativeStartupNotificationClick: () => Promise.resolve(shell.startupClick),
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

// The first import transforms the module graph, the core library's barrel included: seconds
// on a loaded machine, against a 5 s test timeout. Paid once here, so each test's fresh
// import below only evaluates it again.
beforeAll(async () => {
  await import('./native-shell-initializer');
}, 60_000);

beforeEach(() => {
  vi.resetModules();
  shell.desktop = true;
  shell.mobile = false;
  shell.boot = [];
  shell.backFails = false;
  shell.calls = [];
  shell.pending = [];
  shell.signal = null;
  shell.listenFails = false;
  shell.store.mockReset();
  shell.clickTransport = false;
  shell.click = null;
  shell.startupClick = null;
  shell.push.mockReset();
  shell.markRead.mockReset();
  shell.tenantHost = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
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

describe('a desktop notification click', () => {
  const LINK = 'https://www.flamingo.run/releases/v1-5-81';
  const announcement = {
    type: 'ANNOUNCEMENT',
    category: 'GENERIC',
    notificationId: 'n-1',
    attributes: { link: LINK },
  };

  it("opens an announcement's link in the system browser, leaves the app where it is, and reads it", async () => {
    shell.clickTransport = true;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await mount();
    await vi.waitFor(() => expect(shell.click).not.toBeNull());

    act(() => shell.click?.(announcement));

    expect(open).toHaveBeenCalledWith(LINK, '_blank', 'noopener,noreferrer');
    expect(shell.push).not.toHaveBeenCalled();
    expect(shell.markRead.mock.calls).toEqual([['n-1']]);
  });

  it('routes any other click inside the app, and one it cannot place to the notifications page', async () => {
    shell.clickTransport = true;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await mount();
    await vi.waitFor(() => expect(shell.click).not.toBeNull());

    act(() => shell.click?.({ type: 'TICKET_ASSIGNED', notificationId: 'n-3', attributes: { ticketId: 't-1' } }));
    act(() => shell.click?.({ type: 'ANNOUNCEMENT', category: 'GENERIC', notificationId: 'n-4' }));

    expect(shell.push.mock.calls).toEqual([['/tickets/dialog?id=t-1'], ['/notifications']]);
    expect(open).not.toHaveBeenCalled();
    // The ticket is read where it lands; an announcement without a link opens nothing to read.
    expect(shell.markRead).not.toHaveBeenCalled();
  });

  it("navigates inside the app for a link on the tenant's origin, and reads it", async () => {
    shell.tenantHost = 'https://acme.openframe.ai';
    shell.clickTransport = true;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await mount();
    await vi.waitFor(() => expect(shell.click).not.toBeNull());

    act(() =>
      shell.click?.({
        type: 'ANNOUNCEMENT',
        category: 'GENERIC',
        notificationId: 'n-5',
        attributes: { link: 'https://acme.openframe.ai/devices' },
      }),
    );

    expect(shell.push.mock.calls).toEqual([['/devices']]);
    expect(open).not.toHaveBeenCalled();
    expect(shell.markRead.mock.calls).toEqual([['n-5']]);
  });

  it('follows the click that started the app', async () => {
    shell.clickTransport = true;
    shell.startupClick = announcement;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await mount();

    await vi.waitFor(() => expect(open).toHaveBeenCalledWith(LINK, '_blank', 'noopener,noreferrer'));
  });
});

describe('the report that this bundle booted', () => {
  // A release whose back setup throws stops there, unconfirmed, and the shell reverts it.
  // Hydration can wait on a biometric prompt, so the report cannot come after it.
  it('goes out on the mobile shell after the chrome and back setup, and before the tokens are hydrated', async () => {
    shell.desktop = false;
    shell.mobile = true;
    await mount();
    expect(shell.boot).toEqual(['native chrome', 'hardware back', 'confirm bundle', 'hydrate tokens']);
  });

  it('is withheld from a bundle whose back setup throws', async () => {
    shell.desktop = false;
    shell.mobile = true;
    shell.backFails = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(mount()).rejects.toThrow('no back bridge');
    expect(shell.boot).toEqual(['native chrome']);
  });

  it('goes out once per document, however often the initializer mounts', async () => {
    shell.desktop = false;
    shell.mobile = true;
    await mount();
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    expect(shell.boot.filter(step => step === 'confirm bundle')).toHaveLength(1);
    expect(shell.boot.filter(step => step === 'hydrate tokens')).toHaveLength(2);
  });

  it('is not made on the desktop shell or in the browser', async () => {
    await mount();
    expect(shell.boot).toEqual(['hydrate tokens']);

    act(() => root.unmount());
    root = createRoot(container);
    shell.desktop = false;
    shell.boot = [];
    await mount();
    expect(shell.boot).toEqual([]);
  });
});
