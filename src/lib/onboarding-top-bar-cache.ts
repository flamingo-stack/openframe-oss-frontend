/**
 * Storage layer for the app shell's cached onboarding banner decision — which
 * banner (if any) the `topBar` slot last resolved to, persisted so a cold start
 * can reserve the same band before backend progress arrives.
 *
 * Kept UI-free and in `lib/` on purpose: `auth-store.logout()` clears this
 * SYNCHRONOUSLY (a dynamic import can lose the race with `forceLogout`'s
 * `window.location.replace`), and pulling the banner components into the auth
 * store's static graph for that is the wrong trade. The React side — the hook
 * and the `CachedOnboardingTopBar` renderer — lives in
 * `@/app/components/onboarding-top-bar-cache`.
 *
 * The decision is per USER, not per browser: the band belongs to whoever the
 * progress was fetched for, so every read is scoped to an owner id and a
 * signed-out shell has no owner to read for.
 */

/** `none` is a real, cacheable answer: onboarding finished ⇒ never reserve the band. */
export type OnboardingTopBarKind = 'initial-setup' | 'tour' | 'none';

export interface CachedOnboardingTopBar {
  kind: OnboardingTopBarKind;
  /** Drives the CTA copy ("Start Setup" vs "Continue Setup"), which sets its width. */
  started: boolean;
  /**
   * The user this decision was computed for. `localStorage` is per-origin, so
   * without it a second account signing in to the same tab replays the first
   * account's banner — and so does a reload that finds no session at all.
   */
  userId: string;
}

const STORAGE_KEY = 'openframe:onboarding-top-bar-v1';
const KINDS: readonly OnboardingTopBarKind[] = ['initial-setup', 'tour', 'none'];

/**
 * The cached decision for `ownerId`, or `null` when there is nothing safe to
 * replay — no owner (signed out / session not established), no entry, or an
 * entry belonging to somebody else.
 *
 * The storage key is deliberately NOT bumped for the added `userId`: entries
 * written by the previous shape fail the check below, so they are ignored and
 * then overwritten in place on the next write — a new key would leave the old
 * one behind as dead bytes for every existing user instead.
 */
export function readCachedOnboardingTopBar(ownerId: string | null): CachedOnboardingTopBar | null {
  if (typeof window === 'undefined') return null;
  // No session to attribute the band to: reserving one here is what put a
  // signed-out reload's skeleton under a stale onboarding banner.
  if (!ownerId) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Written by us, but a stale/hand-edited entry must not render a bogus band.
    if (!parsed || !KINDS.includes(parsed.kind)) return null;
    if (typeof parsed.userId !== 'string' || parsed.userId !== ownerId) return null;
    return { kind: parsed.kind, started: !!parsed.started, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function writeCachedOnboardingTopBar(next: CachedOnboardingTopBar): void {
  if (typeof window === 'undefined') return;
  // An ownerless entry could never be read back (see above), so don't store one.
  if (!next.userId) return;
  try {
    const serialized = JSON.stringify(next);
    if (window.localStorage.getItem(STORAGE_KEY) === serialized) return;
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Private mode / quota — no band is reserved; the bar drops in as before.
  }
}

/**
 * Drop the persisted decision. Called from `auth-store.logout()` — the owner
 * check already stops another account from replaying this entry, but an
 * expired-session reload still carries the same owner id, and the banner has a
 * live CTA that routes into the app. Clearing on the way out means the next
 * boot has nothing to replay at all.
 */
export function clearCachedOnboardingTopBar(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode — nothing was persisted to clear.
  }
}
