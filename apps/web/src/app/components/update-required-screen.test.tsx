/**
 * The blocking "Update required" screen's one action. It is the store, unless the shell's
 * over-the-air updater holds a downloaded bundle that lifts the block: then it is a restart into
 * that bundle. While it is the store, the screen keeps asking the shell for one. A refused restart
 * falls back to the store at once, and the next look offers the restart again only if the shell
 * still reports a pending bundle that lifts the block. Run against the real `native-update` and
 * `version-check`, over a fake of the shell's `NativeUpdate` plugin.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeUpdatePlugin, NativeUpdateState } from '@/lib/native-shell';

// The shell answers check() from its last result for 60 s after that check ended.
const SHELL_WINDOW_MS = 60_000;
const LOOK_AGAIN_MS = 65_000;

const shell = vi.hoisted(() => ({
  update: null as NativeUpdatePlugin | null,
  bundleVersion: '1.0.130',
  resume: null as (() => void) | null,
  openStore: vi.fn<() => void>(),
}));

vi.mock('@/lib/platform', () => ({ isMobileShell: () => true, mobilePlatform: () => 'ios' }));
vi.mock('@/lib/client-identity', () => ({ clientBundleVersion: () => shell.bundleVersion }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => '' } }));
vi.mock('@/lib/native-back', () => ({ pushBackDismissible: () => () => {} }));
vi.mock('@/lib/native-shell', () => ({
  appPlugin: () => null,
  nativeAuthPlugin: () => null,
  splashScreenPlugin: () => null,
  nativeShellVersion: () => Promise.resolve(null),
  nativeErrorCode: (error: unknown) => (error as { code?: string } | null)?.code ?? null,
  nativeUpdatePlugin: () => shell.update,
  onAppResume: (callback: () => void) => {
    shell.resume = callback;
    return () => {
      shell.resume = null;
    };
  },
}));
// The store action is a top-level navigation, which jsdom does not perform.
vi.mock('@/lib/version-check', async importOriginal => ({
  ...(await importOriginal<object>()),
  openStore: shell.openStore,
}));

function stateWith(pendingVersion: string | null): NativeUpdateState {
  return {
    enabled: true,
    builtinVersion: '1.0.130',
    bridgeLevel: 1,
    bootedVersion: null,
    trial: false,
    activeVersion: null,
    pendingVersion,
  };
}

interface Updater {
  getState: ReturnType<typeof vi.fn<() => Promise<NativeUpdateState>>>;
  check: ReturnType<typeof vi.fn<() => Promise<NativeUpdateState>>>;
  applyPending: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

/** A shell that holds `held` now, and whose check settles with `checked`. */
function updater(held: string | null, checked: Promise<NativeUpdateState> | string | null = held): Updater {
  const fake: Updater = {
    getState: vi.fn(() => Promise.resolve(stateWith(held))),
    check: vi.fn(() => (checked instanceof Promise ? checked : Promise.resolve(stateWith(checked)))),
    applyPending: vi.fn(() => Promise.resolve()),
  };
  shell.update = fake;
  return fake;
}

let container: HTMLDivElement;
let root: Root;

async function mount(policy: { minBundleVersion?: string } | null = { minBundleVersion: '1.0.135' }) {
  const { useAppUpdateStore } = await import('@/lib/version-check');
  useAppUpdateStore.setState({ policy, required: { storeUrl: null } });
  const { UpdateRequiredScreen } = await import('./update-required-screen');
  await act(async () => root.render(<UpdateRequiredScreen />));
}

function action(): HTMLButtonElement {
  const buttons = container.querySelectorAll('button');
  expect(buttons).toHaveLength(1);
  return buttons[0];
}

async function tapAction() {
  await act(async () => action().dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// The first import transforms the core library's barrel: seconds on a loaded machine, against a
// 5 s test timeout. Paid once here.
beforeAll(async () => {
  await import('./update-required-screen');
}, 60_000);

beforeEach(() => {
  shell.update = null;
  shell.bundleVersion = '1.0.130';
  shell.resume = null;
  shell.openStore.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('with a pending bundle that lifts the block', () => {
  it('offers Restart to Update, which swaps to the pending bundle', async () => {
    const shellUpdater = updater('1.0.135');
    await mount();

    expect(action().textContent).toBe('Restart to Update');
    expect(container.textContent).toContain('Update downloaded');
    expect(container.textContent).not.toContain('App Store');
    // The shell already holds it: nothing to look for.
    expect(shellUpdater.check).not.toHaveBeenCalled();

    await tapAction();

    expect(shellUpdater.applyPending).toHaveBeenCalledTimes(1);
    expect(shell.openStore).not.toHaveBeenCalled();
  });

  it('offers it when the policy never arrived, so no minimum is known', async () => {
    updater('1.0.131');
    await mount(null);
    expect(action().textContent).toBe('Restart to Update');
  });

  it('goes back to the store when the shell refuses the restart', async () => {
    const shellUpdater = updater('1.0.135');
    shellUpdater.applyPending.mockRejectedValue(Object.assign(new Error('nothing to apply'), { code: 'NO_PENDING' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();

    await tapAction();

    expect(action().textContent).toBe('Update Now');
    expect(action().disabled).toBe(false);
    await tapAction();
    expect(shell.openStore).toHaveBeenCalledTimes(1);
  });

  it('goes back to the store when a policy arrives that the pending bundle is below', async () => {
    updater('1.0.135');
    await mount();
    expect(action().textContent).toBe('Restart to Update');

    const { useAppUpdateStore } = await import('@/lib/version-check');
    act(() => useAppUpdateStore.setState({ policy: { minBundleVersion: '1.0.140' } }));

    expect(action().textContent).toBe('Update Now');
  });
});

describe('with no pending bundle', () => {
  it('keeps the store action while the shell checks, and flips when the check brings one', async () => {
    let settleCheck: (state: NativeUpdateState) => void = () => {};
    const shellUpdater = updater(null, new Promise<NativeUpdateState>(resolve => (settleCheck = resolve)));
    await mount();

    expect(shellUpdater.check).toHaveBeenCalledTimes(1);
    expect(action().textContent).toBe('Update Now');
    expect(container.textContent).toContain('App Store');
    await tapAction();
    expect(shell.openStore).toHaveBeenCalledTimes(1);

    await act(async () => settleCheck(stateWith('1.0.135')));

    expect(action().textContent).toBe('Restart to Update');
    await tapAction();
    expect(shellUpdater.applyPending).toHaveBeenCalledTimes(1);
    expect(shell.openStore).toHaveBeenCalledTimes(1);
  });

  it('stays on the store action when the check finds nothing', async () => {
    const shellUpdater = updater(null);
    await mount();

    expect(shellUpdater.check).toHaveBeenCalledTimes(1);
    expect(action().textContent).toBe('Update Now');
  });

  it('looks again when the app comes back to the foreground', async () => {
    const shellUpdater = updater(null);
    await mount();
    expect(action().textContent).toBe('Update Now');

    shellUpdater.getState.mockResolvedValue(stateWith('1.0.135'));
    await act(async () => shell.resume?.());

    expect(action().textContent).toBe('Restart to Update');
  });
});

describe('while the store action is up', () => {
  it('looks again by itself, just past the window in which the shell repeats its last answer', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();
    expect(shellUpdater.check).toHaveBeenCalledTimes(1);

    await wait(SHELL_WINDOW_MS);
    expect(shellUpdater.check).toHaveBeenCalledTimes(1);

    shellUpdater.check.mockResolvedValue(stateWith('1.0.135'));
    await wait(LOOK_AGAIN_MS - SHELL_WINDOW_MS);

    expect(shellUpdater.check).toHaveBeenCalledTimes(2);
    expect(action().textContent).toBe('Restart to Update');
  });

  it('keeps looking for as long as nothing turns up', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();

    // One wait per look: the next one is timed when the screen renders the end of this one.
    await wait(LOOK_AGAIN_MS);
    await wait(LOOK_AGAIN_MS);
    await wait(LOOK_AGAIN_MS);

    expect(shellUpdater.check).toHaveBeenCalledTimes(4);
    expect(action().textContent).toBe('Update Now');
  });

  it('counts from the end of the last look, not from its start', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();
    // The second check downloads for 20 s and fails.
    shellUpdater.check.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve(stateWith(null)), 20_000)),
    );
    await wait(LOOK_AGAIN_MS + 20_000);
    expect(shellUpdater.check).toHaveBeenCalledTimes(2);

    await wait(LOOK_AGAIN_MS - 1);
    expect(shellUpdater.check).toHaveBeenCalledTimes(2);
    await wait(1);
    expect(shellUpdater.check).toHaveBeenCalledTimes(3);
  });

  it('counts again from a look made on return to the app', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();

    await wait(30_000);
    await act(async () => shell.resume?.());
    expect(shellUpdater.check).toHaveBeenCalledTimes(2);

    await wait(LOOK_AGAIN_MS - 1);
    expect(shellUpdater.check).toHaveBeenCalledTimes(2);
    await wait(1);
    expect(shellUpdater.check).toHaveBeenCalledTimes(3);
  });

  it('stops looking once a pending bundle lifts the block', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();
    shellUpdater.getState.mockResolvedValue(stateWith('1.0.135'));
    await wait(LOOK_AGAIN_MS);
    expect(action().textContent).toBe('Restart to Update');
    const looks = shellUpdater.getState.mock.calls.length;

    await wait(LOOK_AGAIN_MS * 3);

    expect(shellUpdater.getState).toHaveBeenCalledTimes(looks);
  });

  it('looks again when a policy arrives that the pending bundle is below', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater('1.0.135');
    await mount();
    await wait(LOOK_AGAIN_MS * 3);
    expect(shellUpdater.check).not.toHaveBeenCalled();

    const { useAppUpdateStore } = await import('@/lib/version-check');
    act(() => useAppUpdateStore.setState({ policy: { minBundleVersion: '1.0.140' } }));
    shellUpdater.check.mockResolvedValue(stateWith('1.0.140'));
    await wait(LOOK_AGAIN_MS);

    expect(shellUpdater.check).toHaveBeenCalledTimes(1);
    expect(action().textContent).toBe('Restart to Update');
  });

  it('stops looking when the screen is gone', async () => {
    vi.useFakeTimers();
    const shellUpdater = updater(null);
    await mount();
    const looks = shellUpdater.getState.mock.calls.length;

    act(() => root.unmount());
    root = createRoot(container);
    await wait(LOOK_AGAIN_MS * 3);

    expect(shellUpdater.getState).toHaveBeenCalledTimes(looks);
  });
});

describe('after the shell refused a restart', () => {
  function refusingUpdater(held: string): Updater {
    const shellUpdater = updater(held);
    shellUpdater.applyPending.mockRejectedValue(Object.assign(new Error('nothing to apply'), { code: 'NO_PENDING' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    return shellUpdater;
  }

  // The shell drops a pending bundle it cannot boot, so one it still reports was refused for a
  // passing reason (its state could not be written, say), and the next try may go through.
  it('offers it again on return to the app while the shell still reports it', async () => {
    const shellUpdater = refusingUpdater('1.0.135');
    await mount();
    await tapAction();
    expect(action().textContent).toBe('Update Now');

    await act(async () => shell.resume?.());
    expect(action().textContent).toBe('Restart to Update');
    expect(shellUpdater.check).not.toHaveBeenCalled();

    shellUpdater.applyPending.mockResolvedValue(undefined);
    await tapAction();
    expect(shellUpdater.applyPending).toHaveBeenCalledTimes(2);
  });

  it('offers it again at its own look, timed from the refusal, while the shell still reports it', async () => {
    vi.useFakeTimers();
    const shellUpdater = refusingUpdater('1.0.135');
    await mount();
    await tapAction();
    expect(action().textContent).toBe('Update Now');

    await wait(LOOK_AGAIN_MS - 1);
    expect(action().textContent).toBe('Update Now');
    await wait(1);

    expect(action().textContent).toBe('Restart to Update');
    expect(shellUpdater.applyPending).toHaveBeenCalledTimes(1);
  });

  it('stays on the store action once the shell dropped it, asks for a check, and offers what the check brings', async () => {
    const shellUpdater = refusingUpdater('1.0.135');
    await mount();
    await tapAction();
    shellUpdater.getState.mockResolvedValue(stateWith(null));
    shellUpdater.check.mockResolvedValue(stateWith(null));

    await act(async () => shell.resume?.());
    expect(shellUpdater.check).toHaveBeenCalledTimes(1);
    expect(action().textContent).toBe('Update Now');

    shellUpdater.check.mockResolvedValue(stateWith('1.0.136'));
    await act(async () => shell.resume?.());
    expect(action().textContent).toBe('Restart to Update');
  });
});

describe('with a pending bundle that does not lift the block', () => {
  it.each([
    ['below the policy minimum', '1.0.134'],
    ['this very bundle, booted on trial', '1.0.130'],
    ['older than this bundle', '1.0.129'],
  ])('keeps the store action and asks the shell to check: %s', async (_label, pending) => {
    const shellUpdater = updater(pending);
    await mount();

    expect(shellUpdater.check).toHaveBeenCalledTimes(1);
    expect(action().textContent).toBe('Update Now');
    await tapAction();
    expect(shell.openStore).toHaveBeenCalledTimes(1);
    expect(shellUpdater.applyPending).not.toHaveBeenCalled();
  });
});

describe('on a shell without the updater', () => {
  it('keeps the store action', async () => {
    await mount();

    expect(action().textContent).toBe('Update Now');
    await tapAction();
    expect(shell.openStore).toHaveBeenCalledTimes(1);
  });

  it('keeps it when the plugin is there with none of its methods', async () => {
    shell.update = {};
    await mount();
    expect(action().textContent).toBe('Update Now');
  });
});
