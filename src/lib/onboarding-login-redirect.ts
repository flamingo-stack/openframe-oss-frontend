/**
 * One-shot "redirect to personal onboarding after login" intent.
 *
 * The personal ("Get Started") onboarding is normally optional chrome (sidebar
 * tab + top bar). We additionally send the user to `/onboarding` exactly ONCE,
 * right after a fresh login, when their personal onboarding is still unfinished.
 *
 * Because the primary login path is SSO — a full-page navigation out to the IdP
 * and back to `/dashboard` — the intent must survive a page reload but not leak
 * across browser sessions. `sessionStorage` is exactly that: per-tab, cleared on
 * tab close, preserved across same-tab full-page navigations (the SSO round trip).
 *
 * Flow:
 *   1. `markPersonalOnboardingRedirectPending()` — called the moment a login is
 *      initiated (see `loginWithSso`).
 *   2. `consumePersonalOnboardingRedirectPending()` — read-and-clear, called by
 *      `PersonalOnboardingRedirectGate` once onboarding progress has loaded. It
 *      returns `true` at most once per login, so the redirect can never loop.
 */

const STORAGE_KEY = 'of:onboarding-redirect-after-login';

/** Mark that the next authenticated landing should consider a personal-onboarding redirect. */
export function markPersonalOnboardingRedirectPending(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // sessionStorage can throw in private-mode / sandboxed contexts — the redirect
    // is a nicety, not load-bearing, so silently degrade to "no redirect".
  }
}

/**
 * Read and clear the pending flag in one step. Returns `true` only when a login
 * had queued the redirect; always clears, so subsequent calls return `false`.
 */
export function consumePersonalOnboardingRedirectPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pending = window.sessionStorage.getItem(STORAGE_KEY) === '1';
    if (pending) window.sessionStorage.removeItem(STORAGE_KEY);
    return pending;
  } catch {
    return false;
  }
}
