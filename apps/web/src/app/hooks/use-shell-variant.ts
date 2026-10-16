'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import {
  MINGO_FIRST_FLAG,
  readClassicLayout,
  readDevShellOverride,
  resolveMingoFirstGate,
  resolveMingoV2ChatGate,
  resolveShellVariant,
  setClassicLayout,
  type ShellVariant,
  subscribeClassicLayout,
  subscribeDevShellOverride,
} from '@/lib/shell-variant';
import { useFeatureFlagGate } from './use-feature-flag';

/** Server snapshots: storage is unreadable there, and the flags are unanswered anyway. */
const noOverride = () => null;
const notClassic = () => false;

/**
 * The tenant's `mingo-first` answer after the development override (see
 * `DEV_SHELL_OVERRIDE_KEY`), WITHOUT the user's opt-out — what decides whether the
 * "Classic layout" switch is offered at all. Anything that picks a layout reads
 * {@link useShellVariant} instead.
 */
export function useMingoFirstGate(): FeatureFlagGate {
  const serverGate = useFeatureFlagGate(MINGO_FIRST_FLAG);
  const devOverride = useSyncExternalStore(subscribeDevShellOverride, readDevShellOverride, noOverride);
  return resolveMingoFirstGate(serverGate, devOverride);
}

/**
 * The "Classic layout" opt-out: `[optedOut, setOptedOut]`. Writing it re-renders every
 * reader in this tab (and other tabs) — the shell switches in place, no reload.
 */
export function useClassicLayout(): readonly [boolean, (classic: boolean) => void] {
  const classic = useSyncExternalStore(subscribeClassicLayout, readClassicLayout, notClassic);
  return [classic, setClassicLayout] as const;
}

/**
 * Which shell to render: `'loading'` until the `mingo-first` flag answers, then
 * `'classic'` or `'mingo'`. The ONE read of the flag — see `lib/shell-variant.ts` for
 * the opt-out and the development override folded in here.
 *
 * `'loading'` must be rendered as a loading state: never redirect on it, never pick a
 * layout for it.
 */
export function useShellVariant(): ShellVariant {
  const [classic] = useClassicLayout();
  return resolveShellVariant(useMingoFirstGate(), classic);
}

/**
 * Whether the chat uses the v2 look: the Mingo-first shell implies it, and the classic
 * shell asks `mingo-v2`. Read this instead of `mingo-v2` wherever the question is
 * "which chat look", not "drawer or side panel".
 */
export function useMingoV2ChatGate(): FeatureFlagGate {
  const variant = useShellVariant();
  const mingoV2 = useFeatureFlagGate('mingo-v2');
  return resolveMingoV2ChatGate(variant, mingoV2);
}

const REDIRECT_TRIES = 3;
const REDIRECT_RETRY_MS = 400;

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

/**
 * Send a route that belongs to the OTHER shell to its equivalent in this one: replaces
 * the URL with `target` once it is non-null. Pass `null` for "stay" — including while
 * the variant is `'loading'`, which must never redirect.
 *
 * `carryLocation` appends the live query and fragment, read from `window.location` when
 * it fires rather than from `useSearchParams()`, which lags a `replaceState` by a
 * transition; `target` must then be a bare path.
 */
export function useShellRedirect(target: string | null, { carryLocation = false } = {}): void {
  const router = useRouter();
  useEffect(() => {
    if (target === null) return undefined;
    const href = carryLocation ? `${target}${window.location.search}${window.location.hash}` : target;
    const targetPath = trimSlash(new URL(href, window.location.origin).pathname);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      router.replace(href);
      // A `replaceState` from another URL writer in the same commit (the classic drawer's
      // `?mingoDialog=` sync, when the shell flips under an open chat) drops this navigation.
      timer = setTimeout(() => {
        if (trimSlash(window.location.pathname) !== targetPath && ++tries < REDIRECT_TRIES) go();
      }, REDIRECT_RETRY_MS);
    };
    go();
    return () => clearTimeout(timer);
  }, [target, carryLocation, router]);
}
