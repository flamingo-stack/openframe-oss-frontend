/**
 * The bundle's half of the mobile shells' over-the-air updater (`NativeUpdate`, design in
 * `apps/mobile/docs/ota.md`). The shell finds, verifies and boots a newer bundle by itself, and
 * a bundle has two things to say back: that it works, and, from the force-update screen,
 * "restart into the bundle you already hold".
 *
 * The same bundle runs on shells without the updater (every store build before it), on desktop
 * and in the browser. There `nativeUpdatePlugin()` is null and everything here does nothing.
 */

import {
  appPlugin,
  nativeAuthPlugin,
  nativeErrorCode,
  type NativeUpdateState,
  nativeUpdatePlugin,
  splashScreenPlugin,
} from './native-shell';

// The members are keys of the plugin's interface: renamed there, a name here stops compiling
// instead of missing on every phone and reverting every over-the-air release.
function missingMembers<P extends object>(name: string, plugin: P | null, members: readonly (keyof P & string)[]) {
  return members.filter(member => typeof plugin?.[member] !== 'function').map(member => `${name}.${member}`);
}

/**
 * The bridge this bundle cannot run without: sign-in, token custody, lifting the launch splash,
 * and the shell version the force-update policy compares.
 */
function missingCoreSurface(): string[] {
  return [
    ...missingMembers('NativeAuth', nativeAuthPlugin(), [
      'start',
      'exchangeTicket',
      'getTokens',
      'setTokens',
      'clearTokens',
    ]),
    ...missingMembers('SplashScreen', splashScreenPlugin(), ['hide']),
    ...missingMembers('App', appPlugin(), ['getInfo']),
  ];
}

/**
 * Tell the shell this bundle booted and can work with it. A downloaded bundle starts on trial,
 * and the shell reverts one that never reports ready, so the report is withheld when the shell
 * lacks a core method: that is a bundle released with a `REQUIRED_BRIDGE_LEVEL` below what it
 * really needs, and being reverted is the way out of it.
 *
 * The bridge call goes out before the first `await`, so calling this ahead of token hydration
 * puts it ahead of a biometric prompt as well. Never throws.
 */
export async function confirmBundleBooted(): Promise<void> {
  try {
    const update = nativeUpdatePlugin();
    if (typeof update?.notifyReady !== 'function') return;
    const missing = missingCoreSurface();
    if (missing.length > 0) {
      console.error(`[Native Update] bundle not confirmed, the shell lacks: ${missing.join(', ')}`);
      return;
    }
    await update.notifyReady();
  } catch (error) {
    console.error('[Native Update] bundle not confirmed:', error);
  }
}

function versionOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

/**
 * The bridge's answer is whatever the shell put there, and TypeScript cannot check it: a field
 * that is missing or of another type reads as null, 0 or false.
 */
function normalizeState(raw: Partial<NativeUpdateState>): NativeUpdateState {
  return {
    enabled: raw.enabled === true,
    builtinVersion: versionOrNull(raw.builtinVersion),
    bridgeLevel: typeof raw.bridgeLevel === 'number' ? raw.bridgeLevel : 0,
    bootedVersion: versionOrNull(raw.bootedVersion),
    trial: raw.trial === true,
    activeVersion: versionOrNull(raw.activeVersion),
    pendingVersion: versionOrNull(raw.pendingVersion),
  };
}

async function updateState(method: 'getState' | 'check'): Promise<NativeUpdateState | null> {
  try {
    const raw: Partial<NativeUpdateState> | undefined = await nativeUpdatePlugin()?.[method]?.();
    return raw ? normalizeState(raw) : null;
  } catch (error) {
    console.warn(`[Native Update] ${method} failed:`, error);
    return null;
  }
}

/** What the updater holds right now. Null when the shell has no updater, or could not say. */
export function readUpdateState(): Promise<NativeUpdateState | null> {
  return updateState('getState');
}

/**
 * Ask the shell to look for a newer bundle now, and resolve with its state once it has finished:
 * seconds when there is one to download. Null as for `readUpdateState`.
 */
export function checkForUpdate(): Promise<NativeUpdateState | null> {
  return updateState('check');
}

/**
 * Swap the web view to the pending bundle. The shell reloads the web view on success, so this
 * document rarely sees the `true`; `false` means it is still on the bundle it had: no updater,
 * or the shell refused (`NativeUpdatePlugin.applyPending` lists why).
 */
export async function restartIntoPendingUpdate(): Promise<boolean> {
  try {
    const update = nativeUpdatePlugin();
    if (typeof update?.applyPending !== 'function') return false;
    await update.applyPending();
    return true;
  } catch (error) {
    console.error('[Native Update] restart into the pending bundle refused:', nativeErrorCode(error) ?? error);
    return false;
  }
}
