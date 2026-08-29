'use client';

import { useLocalStorage, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { authApiClient } from '@/lib/auth-api-client';
import { nativeLogin, nativeSsoRegister } from '@/lib/native-login';
import { unregisterNativePush } from '@/lib/native-push';
import { isAppShell, isMobileShell } from '@/lib/platform';
import { appendPosthogHandoff, markPendingSignup } from '@/lib/posthog/posthog-events';
import { collectRegistrationAttribution } from '@/lib/registration-attribution';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { isBearerAuthMode } from '@/lib/token-store';
import { AUTH_ERROR_CODE, getPrNamespaceIssue, type PrNamespaceIssue } from '../constants/auth-error-codes';
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
 * Outcome of {@link useAuth.registerOrganization}. A PR-namespace failure is
 * returned (not toasted) so the caller can hold it inline; every other outcome —
 * success, generic failure, network error — is handled here and returns empty.
 */
interface RegisterResult {
  prNamespaceIssue?: PrNamespaceIssue;
}

interface SsoRegisterRequest {
  tenantName: string;
  tenantDomain: string;
  email: string;
  provider: 'google' | 'microsoft' | 'apple';
  redirectTo?: string;
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
 * Sign in with Apple authenticates whichever Apple ID is signed into the device
 * — it has no credential entry — so the identity is frequently NOT the account
 * the email field just resolved. The gateway then validates the credential fine
 * and 401s for want of a linked account, which the shell rejects with this code.
 * An ordinary outcome deserving actionable copy, not a raw HTTP status: App
 * Review cited "Apple exchange failed with status 401" as a bug (2.1).
 * Recovery is the account's own email, or Sign Up to create an organization
 * against this Apple ID.
 */
function isAppleAccountNotLinked(error: unknown): boolean {
  return (
    (error as { code?: string } | null)?.code === 'APPLE_ACCOUNT_NOT_LINKED' ||
    (error instanceof Error && error.message === 'APPLE_ACCOUNT_NOT_LINKED')
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

  // Track when localStorage hooks are initialized
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const discoverTenants = async (userEmail: string): Promise<TenantDiscoveryResponse | null> => {
    setIsLoading(true);

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

      if (data.has_existing_accounts && data.tenant_id) {
        const tenantInfo = {
          tenantId: data.tenant_id,
          tenantName: '',
          tenantDomain: data.domain || 'localhost',
        };
        const providers = data.auth_providers || ['openframe'];

        setTenantInfo(tenantInfo);
        setAvailableProviders(providers);
        setHasDiscoveredTenants(true);
        setTenantId(data.tenant_id);
      } else {
        setHasDiscoveredTenants(false);
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

  const registerOrganization = async (data: RegisterRequest): Promise<RegisterResult> => {
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
        // A `prNumber` that points at an unprovisioned or not-READY PR
        // environment (dev/QA only). Return it so the signup form can hold a
        // persistent inline notice and offer recovery, rather than a toast that
        // fades and leaves the form looking submittable.
        const prNamespaceIssue = getPrNamespaceIssue(response);
        if (prNamespaceIssue) return { prNamespaceIssue };

        const code = (response.data as any)?.code;
        const message = (response.data as any)?.message || response.error || 'Registration failed';
        let userMessage = 'Registration failed';
        let title = 'Registration Failed';
        const variant: any = 'destructive';

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

      // Client-side replace (not window.location.href) so the success toast
      // survives the transition; replace keeps signup out of the back stack.
      router.replace(routes.auth.checkEmail);
      return {};
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Unable to create organization',
        variant: 'destructive',
      });
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  const registerOrganizationSso = async (data: SsoRegisterRequest) => {
    setIsLoading(true);

    try {
      if (isAppShell()) {
        // The shell must not navigate to the registration URL: Capacitor hands a
        // top-level https nav to the system browser, which creates the tenant in
        // Safari and leaves the app signed out. Run it in the shell's own browser
        // session instead, the same way login does.
        const { tenantHostChanged } = await nativeSsoRegister({
          tenantName: data.tenantName,
          tenantDomain: data.tenantDomain,
          email: data.email,
          provider: data.provider,
        });
        // Registration has a synchronous success point, unlike the browser path
        // below — mark the signup only once the tokens are actually stored, so a
        // dismissed sheet leaves no marker behind.
        markPendingSignup();

        if (tenantHostChanged) {
          // The tenant host was just learned, so module-level clients still hold
          // the boot value — full navigation, not an SPA route. replace, not
          // assign: keep /auth out of the history stack.
          window.location.replace(routes.dashboard);
          return true;
        }
        // Refetch /me BEFORE leaving the auth screen — same reason as loginWithSso.
        await queryClient.refetchQueries({ queryKey: authSessionQueryKey });
        router.replace(routes.dashboard);
        setIsLoading(false);
        return true;
      }

      // Funnel: Google/Microsoft SSO signup. There is no synchronous success
      // point (the browser leaves for OAuth), so mark the pending signup now —
      // `signup_completed` fires when the session resolves after the callback.
      markPendingSignup();
      await authApiClient.registerOrganizationSso(data);
      return true;
    } catch (error: any) {
      if (!isUserCanceled(error)) {
        toast({
          title: 'SSO Registration Failed',
          description: error instanceof Error ? error.message : 'Unable to register organization with SSO',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
      return false;
    }
  };

  const loginWithSso = async (provider: string) => {
    setIsLoading(true);

    try {
      if (tenantInfo?.tenantId) {
        setTenantId(tenantInfo.tenantId);

        if (isAppShell()) {
          const { tenantHostChanged } = await nativeLogin({
            tenantId: tenantInfo.tenantId,
            provider,
            tenantDomain: tenantInfo.tenantDomain !== 'localhost' ? tenantInfo.tenantDomain : undefined,
          });
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
        const loginUrl = authApiClient.loginUrl(tenantInfo.tenantId, returnUrl, provider);
        window.location.href = loginUrl;
      } else {
        throw new Error('No tenant information available for SSO login');
      }
    } catch (error) {
      if (isAppleAccountNotLinked(error)) {
        toast({
          title: 'No OpenFrame account for this Apple ID',
          description:
            'Sign in with the email address on your account instead, or use Sign Up to create a new organization with this Apple ID.',
          variant: 'destructive',
        });
      } else if (!isUserCanceled(error)) {
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
    registerOrganizationSso,
    loginWithSso,
    logout,
    reset,
  };
}
