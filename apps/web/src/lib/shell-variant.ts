import type { FeatureFlagGate, FeatureFlagName } from '@/lib/feature-flags';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

/**
 * Which shell the app renders: the classic one (dashboard home, Mingo in a drawer or
 * side panel) or the Mingo-first one (Project Manhattan: Mingo home, chats as pages).
 *
 * `'loading'` until the `mingo-first` flag answers. It is a real state, not a
 * transient to paper over (see `use-feature-flag.ts`): a redirect, a remount of the
 * layout or a link that guesses here is wrong for one of the two audiences. Render a
 * loading state for it and decide nothing.
 *
 * Framework-neutral on purpose: the React hook is `useShellVariant()`
 * (`app/hooks/use-shell-variant.ts`), and {@link getShellVariant} is the same answer
 * as a snapshot for code that runs outside React (a notification click, a push tap).
 */
export type ShellVariant = 'loading' | 'classic' | 'mingo';

/** The server flag behind the Mingo-first shell. */
export const MINGO_FIRST_FLAG = 'mingo-first' satisfies FeatureFlagName;

/**
 * localStorage key of the per-user "Classic layout" opt-out (`'true'` = opted out).
 *
 * It can only turn the new shell OFF: on a tenant without the flag it does nothing.
 * Kept in this browser rather than on the server because there is no user-preference
 * contract for it yet; it is read live (see {@link subscribeClassicLayout}) and never
 * cached as a flag value.
 */
export const CLASSIC_LAYOUT_KEY = 'of.shell.classic';

/**
 * localStorage key of the DEVELOPMENT-ONLY shell override: `'mingo'` or `'classic'`.
 *
 * Every product flag reads server-first, because a client that could force a feature
 * on would render UI the tenant is not entitled to. This override exists for the one
 * case the server cannot serve: a developer running the new shell against a shared
 * backend whose tenant does not have the flag. So it is honoured only when
 * `process.env.NODE_ENV !== 'production'` — `next dev` and tests, never a build that
 * ships (Next inlines the value, so the branch is dead code there).
 *
 * It replaces the flag's VALUE, not its wait: the variant still reads `'loading'` until
 * the flags query answers, so a forced shell exercises the same loading path as a real
 * one. The "Classic layout" opt-out still applies on top of a forced `'mingo'`.
 *
 *   localStorage.setItem('of.dev.shell', 'mingo');   // then reload
 *   localStorage.removeItem('of.dev.shell');         // back to the server flag
 */
export const DEV_SHELL_OVERRIDE_KEY = 'of.dev.shell';

export type DevShellOverride = 'mingo' | 'classic';

// --------------------------------------------------------------------------
// Pure resolution — what the tests pin
// --------------------------------------------------------------------------

/** The `mingo-first` gate after the development override; `'loading'` is never overridden. */
export function resolveMingoFirstGate(
  serverGate: FeatureFlagGate,
  devOverride: DevShellOverride | null,
): FeatureFlagGate {
  if (serverGate === 'loading' || devOverride === null) return serverGate;
  return devOverride === 'mingo' ? 'on' : 'off';
}

/** The shell variant from the (overridden) flag gate and the user's opt-out. */
export function resolveShellVariant(mingoFirstGate: FeatureFlagGate, classicLayout: boolean): ShellVariant {
  if (mingoFirstGate === 'loading') return 'loading';
  if (mingoFirstGate === 'off' || classicLayout) return 'classic';
  return 'mingo';
}

/**
 * Whether the chat uses the v2 look (rail, docked layout, Reset Onboarding in the chat
 * ⋯ rather than the profile menu): the Mingo-first shell implies it, and in the classic
 * shell `mingo-v2` decides. A tri-state OR — `'on'` as soon as either side is on,
 * `'off'` only when both have answered off.
 */
export function resolveMingoV2ChatGate(variant: ShellVariant, mingoV2Gate: FeatureFlagGate): FeatureFlagGate {
  if (variant === 'mingo' || mingoV2Gate === 'on') return 'on';
  if (variant === 'loading' || mingoV2Gate === 'loading') return 'loading';
  return 'off';
}

// --------------------------------------------------------------------------
// Storage — every access wrapped: Safari private mode and blocked site data throw
// --------------------------------------------------------------------------

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The development override, or `null` in production builds and when unset or malformed. */
export function readDevShellOverride(): DevShellOverride | null {
  if (process.env.NODE_ENV === 'production') return null;
  const value = readStorage(DEV_SHELL_OVERRIDE_KEY);
  return value === 'mingo' || value === 'classic' ? value : null;
}

/** Whether this browser opted out of the Mingo-first shell. */
export function readClassicLayout(): boolean {
  return readStorage(CLASSIC_LAYOUT_KEY) === 'true';
}

const classicLayoutListeners = new Set<() => void>();

/**
 * Set or clear the "Classic layout" opt-out and notify every subscriber in this tab,
 * so the shell switches without a reload. Other tabs follow through the `storage`
 * event (see {@link subscribeClassicLayout}).
 */
export function setClassicLayout(classic: boolean): void {
  try {
    if (classic) window.localStorage.setItem(CLASSIC_LAYOUT_KEY, 'true');
    else window.localStorage.removeItem(CLASSIC_LAYOUT_KEY);
  } catch {
    // Storage refused: the preference cannot persist. Subscribers re-read and see no
    // change, which is the truth — the switch stays where it was.
  }
  for (const listener of classicLayoutListeners) listener();
}

/** `useSyncExternalStore` subscription for the opt-out: in-tab writes and other tabs. */
export function subscribeClassicLayout(listener: () => void): () => void {
  classicLayoutListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CLASSIC_LAYOUT_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    classicLayoutListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** `useSyncExternalStore` subscription for the dev override: other tabs only (set it, then reload). */
export function subscribeDevShellOverride(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DEV_SHELL_OVERRIDE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

// --------------------------------------------------------------------------
// Imperative snapshot
// --------------------------------------------------------------------------

/** The server's `mingo-first` answer, tri-state, from the flag store. */
function serverMingoFirstGate(): FeatureFlagGate {
  const { isLoaded, flags } = useFeatureFlagsStore.getState();
  if (!isLoaded) return 'loading';
  return flags[MINGO_FIRST_FLAG] ? 'on' : 'off';
}

/**
 * {@link ShellVariant} read once, for code outside React. A render must subscribe
 * through `useShellVariant()` instead — this snapshot never updates a component.
 */
export function getShellVariant(): ShellVariant {
  return resolveShellVariant(
    resolveMingoFirstGate(serverMingoFirstGate(), readDevShellOverride()),
    readClassicLayout(),
  );
}
