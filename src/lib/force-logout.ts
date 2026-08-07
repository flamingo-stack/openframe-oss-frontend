import { getDefaultRedirectPath, isSaasTenantMode } from './app-mode';
import { clearTokens, getBiometricLockState, hasTokensSync } from './token-store';

export interface ForceLogoutOptions {
  reason?: string;
  shouldRedirect?: boolean;
  redirectPath?: string;
}

export async function forceLogout(options: ForceLogoutOptions = {}): Promise<void> {
  const { shouldRedirect = true, redirectPath } = options;

  if (typeof window === 'undefined') {
    return;
  }

  // Biometric cold-start lock: the tokens exist in the Keychain but were never
  // read (prompt canceled), so any auth failure that led here is based on
  // unread tokens. Bail — the unlock gate owns recovery; wiping the Keychain
  // here would make its Retry unrecoverable.
  if (getBiometricLockState() === 'locked') {
    return;
  }

  const currentPath = window.location.pathname;
  const isAuthPage = currentPath.startsWith('/auth');

  try {
    await clearTokens();
  } catch (error) {
    console.error('[Force Logout] Failed to clear tokens:', error);
  }

  // Settle the session QUERY first, before the stores below are reset.
  //
  // `useAuthSession`'s `['auth','session']` entry — not the auth store — is what
  // the app shell derives `sessionReady` from, and nothing here used to touch it.
  // The explicit sign-out in `use-auth` always cleared it; this path never did,
  // so a forced sign-out left the query still reporting the last authenticated
  // `/me` while every store it reset went empty. In saas-tenant mode, which
  // returns below WITHOUT a reload, that contradiction was permanent — the shell
  // kept `sessionReady` true, so it never unmounted `OnboardingProgressHydrator`
  // to re-run it, and the onboarding store this reset emptied never refilled:
  // the sidebar and header sat in their skeleton for the rest of the session
  // while the page content, riding a session cookie the server never revoked,
  // kept working normally.
  //
  // `setQueryData(null)` rather than an invalidation, deliberately: `null` is the
  // shape `/me` resolves to when it answers "no user" (and what `signOutToLogin`
  // and the account-deletion flow already write), so it settles the session
  // terminally. Invalidating would REFETCH `/me`, and a 401 there routes straight
  // back into this function through `ApiClient` — a sign-out that re-triggers
  // itself.
  //
  // Ordering matters: this render pass drops `sessionReady`, which unmounts the
  // session-gated children, so the hydrator is already gone when the stores below
  // are cleared and cannot fire a request on the way out.
  try {
    const { getQueryClient } = await import('./query-client');
    const { authSessionQueryKey } = await import('@/app/(auth)/auth/hooks/use-auth-session');
    getQueryClient().setQueryData(authSessionQueryKey, null);
  } catch (error) {
    console.error('[Force Logout] Failed to clear session query:', error);
  }

  try {
    const { useAuthStore } = await import('@/app/(auth)/auth/stores/auth-store');
    const { logout } = useAuthStore.getState();
    logout();
  } catch (error) {
    console.error('[Force Logout] Failed to clear auth store:', error);
  }

  // Clear the user's Mingo working context (persisted `recentViews` + the live
  // store) so it can't leak into the next session. Dynamic import mirrors the
  // auth-store one above — keeps the mingo feature out of this low-level module's
  // static graph. In SaaS-tenant mode this path returns WITHOUT a reload below,
  // so resetting the in-memory store here (not just localStorage) matters.
  try {
    const { clearMingoContext } = await import('@/app/(app)/mingo/stores/mingo-context-store');
    clearMingoContext();
  } catch (error) {
    console.error('[Force Logout] Failed to clear Mingo context:', error);
  }

  if (shouldRedirect && !isAuthPage) {
    if (isSaasTenantMode()) {
      return;
    }
    try {
      const targetPath = redirectPath || getDefaultRedirectPath(false);
      // replace, not assign: don't leave the now-signed-out page in history, so
      // back after a later re-login can't return to a stale logged-out screen.
      window.location.replace(targetPath);
    } catch (_error) {
      window.location.replace('/auth');
    }
  }
}

export function hasStoredTokens(): boolean {
  return hasTokensSync();
}

export function clearStoredTokens(): void {
  void clearTokens();
}
