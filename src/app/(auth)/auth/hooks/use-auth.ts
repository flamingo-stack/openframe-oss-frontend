'use client';

import { useLocalStorage, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authApiClient } from '@/lib/auth-api-client';
import { AppleRegistrationRequiredError, nativeLogin, SsoRegistrationRequiredError } from '@/lib/native-login';
import { unregisterNativePush } from '@/lib/native-push';
import { isAppShell, isMobileShell } from '@/lib/platform';
import { appendPosthogHandoff, markPendingSignup } from '@/lib/posthog/posthog-events';
import { collectRegistrationAttribution } from '@/lib/registration-attribution';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { isBearerAuthMode } from '@/lib/token-store';
import { AUTH_ERROR_CODE } from '../constants/auth-error-codes';
import { useAuthStore } from '../stores/auth-store';
import { authSessionQueryKey } from './use-auth-session';
import { useTokenStorage } from './use-token-storage';

interface TenantInfo {
  tenantId?: string;
  tenantName: string;
  tenantDomain: string;
}

export interface TenantDiscoveryResponse {
  email: string;
  has_existing_accounts: boolean;
  tenant_id?: string | null;
  auth_providers?: string[] | null;
  domain?: string | null;
}

interface RegisterRequest {
  tenantName: string;
  tenantDomain: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Links the registration to a git PR for testing (dev environments only). */
  prNumber?: number;
}

/**
 * Dismissing a native sign-in surface (the Apple sheet, or the shell-owned
 * browser session) is a deliberate user action, not a failure — the shell
 * rejects it with USER_CANCELED, which must not raise a toast.
 */
function isUserCanceled(error: unknown): boolean {
  return (
    (error as { code?: string } | null)?.code === 'USER_CANCELED' ||
    (error instanceof Error && error.message === 'USER_CANCELED')
  );
}

/**
 * Auth actions hook - provides login, registration, and logout functions.
 * Does NOT perform auth checking. Use `useAuthSession` for that.
 */
export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { setTenantId } = useAuthStore();
  const { clearTokens } = useTokenStorage();

  const [email, setEmail] = useLocalStorage('auth:email', '');
  const [tenantInfo, setTenantInfo] = useLocalStorage<TenantInfo | null>('auth:tenantInfo', null);
  const [hasDiscoveredTenants, setHasDiscoveredTenants] = useLocalStorage('auth:hasDiscoveredTenants', false);
  const [availableProviders, setAvailableProviders] = useLocalStorage<string[]>('auth:availableProviders', []);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [discoveryAttempted, setDiscoveryAttempted] = useState(false);
  /** The address of the most recent discovery request, so a stale response cannot overwrite it. */
  const latestDiscovery = useRef<string | null>(null);

  // Track when localStorage hooks are initialized
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const discoverTenants = async (userEmail: string): Promise<TenantDiscoveryResponse | null> => {
    setIsLoading(true);
    // Two lookups can be in flight while the user keeps typing, and they can resolve out of order.
    // The caller's own cancelled-flag protects only its display; this shared state is what
    // `loginWithSso` reads to decide between the per-tenant and identity-first paths, so a late
    // answer for an abandoned address must not be the one that lands.
    latestDiscovery.current = userEmail;

    if (userEmail !== email) {
      setDiscoveryAttempted(false);
      setHasDiscoveredTenants(false);
      setTenantInfo(null);
      setAvailableProviders([]);
    }

    setEmail(userEmail);

    try {
      const response = await authApiClient.discoverTenants(userEmail);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = response.data as TenantDiscoveryResponse;
      if (latestDiscovery.current !== userEmail) {
        return data;
      }

      if (data.has_existing_accounts && data.tenant_id) {
        const discovered = {
          tenantId: data.tenant_id,
          tenantName: '',
          tenantDomain: data.domain || 'localhost',
        };
        const providers = data.auth_providers || ['openframe'];

        setTenantInfo(discovered);
        setAvailableProviders(providers);
        setHasDiscoveredTenants(true);
        setTenantId(data.tenant_id);
      } else {
        // No account for this address — drop any tenant a previous lookup left behind, so an
        // ungated provider click cannot take the per-tenant path with a stale one.
        setHasDiscoveredTenants(false);
        setTenantInfo(null);
        setAvailableProviders([]);
      }

      setDiscoveryAttempted(true);
      return data;
    } catch (error) {
      toast({
        title: 'Discovery Failed',
        description: error instanceof Error ? error.message : 'Unable to check for existing accounts',
        variant: 'destructive',
      });
      setHasDiscoveredTenants(false);
      setDiscoveryAttempted(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const registerOrganization = async (data: RegisterRequest) => {
    setIsLoading(true);

    try {
      const attribution = collectRegistrationAttribution();

      const response = await authApiClient.registerOrganization({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        tenantName: data.tenantName,
        tenantDomain: data.tenantDomain || 'localhost',
        ...(data.prNumber !== undefined ? { prNumber: data.prNumber } : {}),
        ...(attribution ? { attribution } : {}),
      });

      if (!response.ok) {
        // The auth service answers a rejected registration with a code + message
        // body; both are optional because a transport failure carries neither.
        const body = response.data as { code?: string; message?: string } | undefined;
        const code = body?.code;
        const message = body?.message || response.error || 'Registration failed';
        let userMessage = 'Registration failed';
        let title = 'Registration Failed';
        const variant = 'destructive' as const;

        switch (code) {
          case AUTH_ERROR_CODE.TENANT_REGISTRATION_BLOCKED:
            title = 'Service Unavailable';
            userMessage = 'Registration is temporarily unavailable. Please try again later.';
            break;
          default:
            userMessage = message;
        }

        toast({ title, description: userMessage, variant });
        throw new Error(userMessage);
      }

      toast({
        title: 'Success!',
        description: 'Organization created successfully. Check your email to verify your account.',
        variant: 'success',
      });

      // Funnel: registration is server-confirmed. `signup_completed` (with the
      // OpenFrame user.id + email) fires once the authenticated session resolves
      // — see PostHogAnalyticsBridge — since no user id exists yet here (the flow
      // goes to the email-verify step next). Mark the pending signup so it fires.
      markPendingSignup();

      // The verify screen shows the address the link went to, and reads it from here. It used to
      // be written by the two-step signup's first screen; that handoff went away when the steps
      // merged, and without this the screen finds nothing and bounces straight back to /auth.
      // sessionStorage, not the URL: the address is not something to put in a shareable link.
      try {
        sessionStorage.setItem('auth:email', data.email);
      } catch {
        // Best-effort. Losing it costs the address on the verify screen, which bounces to /auth —
        // it must not surface as "Registration Failed" for an account the server already created.
      }

      // Client-side replace (not window.location.href) so the success toast
      // survives the transition; replace keeps signup out of the back stack.
      router.replace(routes.auth.checkEmail);
    } catch (error) {
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Unable to create organization',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSso = async (provider: string) => {
    setIsLoading(true);

    try {
      // Only trust a discovered tenant when discovery actually ran on this screen. `tenantInfo` is
      // persisted in localStorage, so without this a provider click on a freshly-opened screen —
      // they are no longer gated behind a filled-in email — would route down the per-tenant path
      // with a previous session's tenant, which the identity being asserted may have nothing to do
      // with. `discoveryAttempted` is session state, so it is false exactly when that is the case.
      const discovered = discoveryAttempted ? tenantInfo : null;
      if (discovered?.tenantId) {
        setTenantId(discovered.tenantId);
      }

      if (isAppShell()) {
        const { tenantHostChanged } = await nativeLogin(
          discovered?.tenantId
            ? {
                tenantId: discovered.tenantId,
                provider,
                tenantDomain: discovered.tenantDomain !== 'localhost' ? discovered.tenantDomain : undefined,
              }
            : // No tenant: the authorization server runs the flow against its onboarding
              // pseudo-tenant and resolves the real one from the identity the provider asserts.
              // This deliberately does NOT honour a tenant's own SSO credentials — those cannot be
              // looked up before the tenant is known.
              { provider },
        );
        if (tenantHostChanged) {
          // replace, not assign: keep /auth out of the history stack so
          // native/browser back can't return to the login screen post-login.
          // Small delay so a just-fired signup_completed (dataLayer/PostHog)
          // flushes before this hard navigation tears down the page context.
          setTimeout(() => window.location.replace(routes.dashboard), 100);
          return;
        }
        // Refetch /me BEFORE leaving the auth screen (its spinner covers the
        // round trip). A fire-and-forget invalidation left the stale
        // signed-out session in cache, so the dashboard mounted into a brief
        // "Sign in required" overlay until the refetch resolved.
        await queryClient.refetchQueries({ queryKey: authSessionQueryKey });
        router.replace(routes.dashboard);
        setIsLoading(false);
        return;
      }

      if (!discovered?.tenantId) {
        // A relative `/sas/...` here is not a misconfiguration: an unset shared host is the
        // same-origin deployment shape, and every other `/sas` call — discovery, email
        // availability, the pending-identity read — already resolves that way through
        // `buildAuthUrl`. Gating this one on a configured host would block sign-in that works.
        window.location.href = authApiClient.ssoLoginUrl(provider);
        return;
      }

      const getReturnUrl = () => {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = window.location.port ? `:${window.location.port}` : '';
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return `${protocol}//${hostname}${port}/dashboard`;
        }
        return `${window.location.origin}/dashboard`;
      };

      // Carry the PostHog distinct_id + session_id across the (SaaS) auth-host
      // → tenant-dashboard-host hop so the session recording stays continuous.
      // Encoded here, so the `#…` handoff rides through the OAuth roundtrip and
      // becomes a live fragment only when the gateway redirects to the dashboard.
      const returnUrl = encodeURIComponent(appendPosthogHandoff(getReturnUrl()));
      window.location.href = authApiClient.loginUrl(discovered.tenantId, returnUrl, provider);
    } catch (error) {
      // A verified Apple identity with no account is not a failure — the caller renders the
      // organization form and finishes with the credential this carries. Rethrow so the screen
      // can hold it in memory; it must never be toasted or serialised into a URL.
      if (error instanceof AppleRegistrationRequiredError || error instanceof SsoRegistrationRequiredError) {
        setIsLoading(false);
        throw error;
      }
      if (!isUserCanceled(error)) {
        toast({
          title: 'Login Failed',
          description: error instanceof Error ? error.message : 'Unable to sign in with SSO',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    }
  };

  const logout = useCallback(async () => {
    const { tenantId: storeTenantId, user: currentUser } = useAuthStore.getState();
    const effectiveTenantId =
      storeTenantId || currentUser?.tenantId || currentUser?.organizationId || tenantInfo?.tenantId;

    // In either shell revoke server-side BEFORE clearing local tokens —
    // logoutAsync needs the stored refresh token to send the Refresh-Token header,
    // and the push-token DELETE is an authenticated call.
    if (isMobileShell()) {
      // Only the mobile shell holds an FCM registration.
      try {
        await unregisterNativePush();
      } catch {
        // Best-effort; the backend also prunes tokens on APNs rejections.
      }
    }
    if (isAppShell()) {
      try {
        await authApiClient.logoutAsync(effectiveTenantId);
      } catch {
        // Best-effort revocation; local sign-out proceeds regardless.
      }
    }

    const { logout: storeLogout } = useAuthStore.getState();
    storeLogout();

    // Clear React Query auth cache
    queryClient.removeQueries({ queryKey: authSessionQueryKey });

    if (isBearerAuthMode()) {
      await clearTokens();
    }

    setEmail('');
    setTenantInfo(null);
    setHasDiscoveredTenants(false);
    setDiscoveryAttempted(false);
    setAvailableProviders([]);
    setIsLoading(false);

    if (isAppShell()) {
      // No browser redirect in the shell — the route guard shows the sign-in screen.
      return;
    }

    if (effectiveTenantId) {
      authApiClient.logout(effectiveTenantId);
    } else {
      // After an explicit logout the user goes straight to the Login tab.
      // replace, not assign: keep the just-signed-out page out of history.
      const sharedHostUrl = runtimeEnv.sharedHostUrl();
      window.location.replace(`${sharedHostUrl}${routes.auth.login}`);
    }
  }, [clearTokens, setEmail, setTenantInfo, setHasDiscoveredTenants, setAvailableProviders, tenantInfo, queryClient]);

  const reset = () => {
    setEmail('');
    setTenantInfo(null);
    setHasDiscoveredTenants(false);
    setDiscoveryAttempted(false);
    setIsLoading(false);
  };

  return {
    email,
    tenantInfo,
    hasDiscoveredTenants,
    discoveryAttempted,
    availableProviders,
    isLoading,
    isInitialized,
    discoverTenants,
    registerOrganization,
    loginWithSso,
    logout,
    reset,
  };
}
