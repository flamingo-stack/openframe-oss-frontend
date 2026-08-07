'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { isSaasSharedMode } from '@/lib/app-mode';
import { forceLogout } from '@/lib/force-logout';
import { isAppShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { getBiometricLockState, hasTokensSync, initTokenStore } from '@/lib/token-store';
import { useAuthStore } from '../stores/auth-store';

export const authSessionQueryKey = ['auth', 'session'] as const;

/**
 * How often to re-ask `/me` after it has failed OUTRIGHT — every retry spent and
 * still no answer either way.
 *
 * That state used to be terminal. `retry: 2` + `retryDelay: 1000` spends all
 * three attempts inside ~3 seconds — a gateway pod restarting mid-load loses all
 * of them — and afterwards nothing re-asked: the poll below returned `false`
 * without `data.authenticated`, `refetchOnWindowFocus` is off app-wide, and
 * `staleTime` alone never triggers a fetch. `isReady` stayed false for the life
 * of the tab, and only a reload could clear it.
 *
 * What that cost is bigger than a missing user menu, because "the session hasn't
 * resolved" is an input to things that CAN'T then resolve either:
 *   - the feature-flags query is `enabled` on it, so no flag ever loaded and the
 *     sidebar + header sat in their skeleton (`components/app-layout.tsx`);
 *   - `OnboardingProgressHydrator` mounts on it, so onboarding progress was
 *     never fetched — a tenant mid-setup saw no Initial Setup bar at all;
 *   - the request latch in `lib/session-ready.ts` was left neither opened nor
 *     released, so page data went out only once its 10-second fail-open elapsed.
 * The page then WORKED — the session cookie was fine all along, only our answer
 * about it was missing — which is exactly what made the chrome look broken while
 * the content behind it did not.
 *
 * Backed off rather than fixed, because the two cases it has to serve pull in
 * opposite directions. The first recheck is deliberately quicker than the
 * 10-second chrome fail-open in `components/app-layout.tsx`, so a gateway blip is
 * recovered while the shell is still legitimately loading and the user never sees
 * the degraded nav that fail-open draws. A backend that is genuinely down then
 * doubles its way out to a minute, so a tab left open on a dead deployment costs
 * one cheap request a minute instead of twelve.
 *
 * A definite "no user" (401/403 → `null`) is NOT this case: that resolves the
 * session, and the poll below stays off for it.
 */
const AUTH_RECHECK_BASE_MS = 5_000;
const AUTH_RECHECK_MAX_MS = 60_000;

interface MeResponse {
  authenticated: boolean;
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roles?: string[];
    tenantId?: string;
    tenantName?: string;
    organizationId?: string;
    organizationName?: string;
    status?: string;
    image?: { imageUrl: string; hash: string };
  };
}

/**
 * Single source of truth for auth verification.
 */
export function useAuthSession() {
  const queryClient = useQueryClient();
  const storeLogin = useAuthStore(s => s.login);
  const storeLogout = useAuthStore(s => s.logout);
  const setTenantId = useAuthStore(s => s.setTenantId);
  const fetchFullProfile = useAuthStore(s => s.fetchFullProfile);

  const query = useQuery<MeResponse | null>({
    queryKey: authSessionQueryKey,
    queryFn: async () => {
      if (isSaasSharedMode()) {
        return null;
      }
      // Host-less native-shell boot (dynamic tenant, before the first login):
      // there is no gateway to ask yet — an API fetch would hit the bundle's
      // own asset origin and never yield a 401 (Tauri's SPA fallback even
      // answers 200 with HTML). Resolve as signed-out so RouteGuard lands on
      // /auth for tenant discovery instead of an endless shell skeleton.
      if (isAppShell() && !runtimeEnv.tenantHostUrl()) {
        return null;
      }
      if (isAppShell()) {
        // Cold start: wait for the Keychain read (biometric-gated when enabled)
        // so the first /me carries the bearer instead of 401ing into a refresh.
        await initTokenStore();
        // Prompt canceled — the unlock gate owns recovery. Throw (transient) so
        // React Query keeps previous data and the store isn't logged out while
        // the tokens still sit unread in the Keychain.
        if (getBiometricLockState() === 'locked') {
          throw new Error('Biometric unlock pending');
        }
        // No stored tokens ⇒ signed out, no gateway question to ask: the shell
        // is bearer-only (cookies can't cross the capacitor://localhost
        // origin), so a token-less /me is a guaranteed 401. Resolving here
        // skips that round trip — which is what held the cold-start dashboard
        // skeleton on screen before signed-out users were routed to /auth
        // (the splash only covers Keychain hydration, not the /me call).
        if (!hasTokensSync()) {
          return null;
        }
      }
      const response = await apiClient.me<MeResponse>();
      if (response.ok && response.data?.authenticated) {
        return response.data;
      }
      // 401 (unauthenticated) and 403 (forbidden) both mean "not signed in" —
      // resolve to null so the user is shown the sign-in page instead of a
      // blank screen / error state.
      if (response.status === 401 || response.status === 403) {
        return null;
      }
      // For transient errors (500, network), throw so React Query retries
      // and preserves previous query.data (doesn't overwrite with null)
      throw new Error(response.error || `Auth check failed with status ${response.status}`);
    },
    staleTime: 4 * 60 * 1000, // 4 minutes
    refetchInterval: query => {
      if (query.state.data?.authenticated) return runtimeEnv.authCheckIntervalMs();
      // Failed outright — keep asking, backing off per consecutive failure (see
      // AUTH_RECHECK_BASE_MS). Checked AFTER the signed-in branch so a live
      // session that hits one bad refetch keeps its normal cadence instead of
      // dropping to this one.
      if (query.state.status === 'error') {
        const failures = Math.max(query.state.errorUpdateCount, 1);
        return Math.min(AUTH_RECHECK_BASE_MS * 2 ** (failures - 1), AUTH_RECHECK_MAX_MS);
      }
      // Resolved as "no user": answered, nothing to poll for.
      return false;
    },
    // Same recovery, taken sooner: a user coming back to the tab gets the recheck
    // immediately rather than waiting out the interval. Narrowed to the failed
    // case on purpose — the app-wide default is off, and re-asking `/me` on every
    // focus of an already-resolved session is what that default exists to avoid.
    refetchOnWindowFocus: query => query.state.status === 'error',
    retry: 2,
    retryDelay: 1000,
  });

  // Sync React Query data to Zustand auth store
  useEffect(() => {
    if (query.isLoading) return;

    if (query.data?.authenticated && query.data.user) {
      const userData = query.data.user;
      storeLogin({
        id: userData.id || userData.userId || '',
        email: userData.email || '',
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        roles: userData.roles,
        tenantId: userData.tenantId,
        tenantName: userData.tenantName,
        organizationId: userData.organizationId,
        organizationName: userData.organizationName,
        status: userData.status,
        ...(userData.image ? { image: userData.image } : {}),
      });

      const tenantId = userData.tenantId || userData.organizationId;
      if (tenantId) {
        setTenantId(tenantId);
      }

      // Fetch full profile in the background (non-blocking)
      fetchFullProfile();
    } else if (query.data === null && !query.isLoading) {
      // Only logout if we got a definitive "not authenticated" response
      // and we're not still loading
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated && query.fetchStatus === 'idle' && !query.isError) {
        // Session expired / forbidden (401/403) - clear state
        // Skip logout if query is in error state (transient 5xx/network errors)
        storeLogout();
      }
    }
  }, [
    query.data,
    query.isLoading,
    query.isError,
    query.fetchStatus,
    storeLogin,
    storeLogout,
    setTenantId,
    fetchFullProfile,
  ]);

  const recheck = () => {
    queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
  };

  const isReady = !query.isLoading && !(query.isError && query.data === undefined);

  return {
    isReady,
    isAuthenticated: !!query.data?.authenticated,
    isError: query.isError,
    user: query.data?.user ?? null,
    recheck,
  };
}

/**
 * Invalidate the auth session query from outside React components.
 * Useful for login success handlers that need to trigger a recheck.
 */
export function invalidateAuthSession(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
}

/**
 * Hard sign-out that lands on the sign-in flow — for native-shell paths that
 * can't rely on forceLogout's mode-dependent redirect (it skips redirecting in
 * saas-tenant mode) or wait out the warm session cache: clears tokens + auth
 * store, seeds the session query signed-out so the skeleton gates below don't
 * hang on a stale result, then replaces to /auth. Shared by the cold-start
 * unlock gate's "log in another way" and the settings biometric card's
 * enrollment-invalidated path.
 */
export async function signOutToLogin(
  queryClient: ReturnType<typeof useQueryClient>,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  await forceLogout({ shouldRedirect: false });
  queryClient.setQueryData(authSessionQueryKey, null);
  router.replace(routes.auth.root);
}
