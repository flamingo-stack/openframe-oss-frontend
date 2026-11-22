'use client';

import { useLocalStorage, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLandingPath } from '@/lib/app-mode';
import { authApiClient, getRecaptchaCheckedFailureMessage } from '@/lib/auth-api-client';
import { MOBILE_AUTH_ERROR } from '@/lib/mobile-auth-return';
import {
  AppleRegistrationRequiredError,
  nativeLogin,
  NativeLoginError,
  SsoRegistrationRequiredError,
} from '@/lib/native-login';
import { unregisterNativePush } from '@/lib/native-push';
import { nativeErrorCode } from '@/lib/native-shell';
import { isAppShell, isMobileShell } from '@/lib/platform';
import { appendPosthogHandoff, markPendingSignup } from '@/lib/posthog/posthog-events';
import { collectRegistrationAttribution } from '@/lib/registration-attribution';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { isBearerAuthMode } from '@/lib/token-store';
import { readWorkspaceHint } from '@/lib/workspace-entry';
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
  tenant_name?: string | null;
  sso_login_handle?: string | null;
  /** Whether the tenant's built-in OpenFrame login is on; null when no tenant was found. */
  openframe_login_enabled?: boolean | null;
  /** Providers the tenant configured with its OWN app (no platform defaults); null when no tenant was found. */
  custom_providers?: string[] | null;
  domain?: string | null;
}

/** The tenant a provider sign-in goes to. Without one the flow is identity-first. */
export interface SsoLoginTenant {
  tenantId?: string;
  loginHandle?: string;
  /** The tenant's gateway host (discovery's `domain`), when there is one. */
  tenantDomain?: string;
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

const SIGNUP_EMAIL_CONFIRMATION_STATUS = 202;

/**
 * Dismissing a native sign-in surface (the Apple sheet, or the shell-owned
 * browser session) is a deliberate user action, not a failure — the shell
 * rejects it with USER_CANCELED, which must not raise a toast.
 */
function isUserCanceled(error: unknown): boolean {
  return (
    nativeErrorCode(error) === MOBILE_AUTH_ERROR.USER_CANCELED ||
    (error instanceof Error && error.message === MOBILE_AUTH_ERROR.USER_CANCELED)
  );
}

/** A browser sign-in that never finished gets `NativeLoginError`'s title instead of the generic one. */
function loginFailureTitle(error: unknown): string {
  return error instanceof NativeLoginError ? error.title : 'Login Failed';
}

/**
 * Where a web login lands, pre-encoded for the `redirectTo` query param. Carries the PostHog
 * distinct_id + session_id across the (SaaS) auth-host → tenant-dashboard-host hop so the session
 * recording stays continuous: encoded here, the `#…` handoff rides through the OAuth roundtrip and
 * becomes a live fragment only when the gateway redirects to the landing page.
 */
function landingReturnUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const returnUrl =
    hostname === 'localhost' || hostname === '127.0.0.1'
      ? `${protocol}//${hostname}${port}${getLandingPath()}`
      : `${window.location.origin}${getLandingPath()}`;
  return encodeURIComponent(appendPosthogHandoff(returnUrl));
}

/**
 * Auth actions hook - provides login, registration, and logout functions.
 * Does NOT perform auth checking. Use `useAuthSession` for that.
 */
export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const setTenantId = useAuthStore(s => s.setTenantId);
  const { clearTokens } = useTokenStorage();

  const [email, setEmail] = useLocalStorage('auth:email', '');
  const [tenantInfo, setTenantInfo] = useLocalStorage<TenantInfo | null>('auth:tenantInfo', null);
  const [hasDiscoveredTenants, setHasDiscoveredTenants] = useLocalStorage('auth:hasDiscoveredTenants', false);

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  /** The address of the most recent discovery request, so a stale response cannot overwrite it. */
  const latestDiscovery = useRef<string | null>(null);

  // Track when localStorage hooks are initialized
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const discoverTenants = async (userEmail: string): Promise<TenantDiscoveryResponse | null> => {
    setIsLoading(true);
    // Two lookups can be in flight while the user keeps typing, and they can resolve out of order.
    // The caller's own cancelled-flag protects only its display, not the tenant written below, so
    // a late answer for an abandoned address must not be the one that lands.
    latestDiscovery.current = userEmail;

    if (userEmail !== email) {
      setHasDiscoveredTenants(false);
      setTenantInfo(null);
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
        setTenantInfo(discovered);
        setHasDiscoveredTenants(true);
        setTenantId(data.tenant_id);
      } else {
        // No account for this address — drop any tenant a previous lookup left behind.
        setHasDiscoveredTenants(false);
        setTenantInfo(null);
      }

      return data;
    } catch (error) {
      // A failed lookup for an abandoned address must not toast over, or reset, the current one.
      if (latestDiscovery.current !== userEmail) {
        return null;
      }
      toast({
        title: 'Discovery Failed',
        description: error instanceof Error ? error.message : 'Unable to check for existing accounts',
        variant: 'destructive',
      });
      setHasDiscoveredTenants(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /** Runs the shell's native sign-in and lands on the landing page (`getLandingPath`); rejects as `nativeLogin` does. */
  const nativeLoginToLanding = async (options: Parameters<typeof nativeLogin>[0]) => {
    const { tenantHostChanged } = await nativeLogin(options);
    if (tenantHostChanged) {
      // replace, not assign: keep /auth out of the history stack so
      // native/browser back can't return to the login screen post-login.
      // Small delay so a just-fired signup_completed (dataLayer/PostHog)
      // flushes before this hard navigation tears down the page context.
      setTimeout(() => window.location.replace(getLandingPath()), 100);
      return;
    }
    // Refetch /me BEFORE leaving the auth screen (its spinner covers the
    // round trip). A fire-and-forget invalidation left the stale
    // signed-out session in cache, so the landing page mounted into a brief
    // "Sign in required" overlay until the refetch resolved.
    await queryClient.refetchQueries({ queryKey: authSessionQueryKey });
    router.replace(getLandingPath());
    setIsLoading(false);
  };

  /**
   * The organization exists but the sign-in that should follow it did not happen. Say so before
   * showing the login screen: otherwise the obvious next move is a second registration, which
   * fails on the address already being taken.
   */
  const signInToContinue = () => {
    toast({
      title: 'Organization Created',
      description: 'Sign in with your email and password to continue.',
      variant: 'success',
    });
    setIsLoading(false);
    router.replace(routes.auth.login);
  };

  const handleNativeSignupLoginFailure = (error: unknown) => {
    if (isUserCanceled(error)) {
      signInToContinue();
      return;
    }
    toast({
      title: loginFailureTitle(error),
      description: error instanceof Error ? error.message : 'Unable to sign in',
      variant: 'destructive',
    });
    setIsLoading(false);
    router.replace(routes.auth.login);
  };

  const continueSignupInNativeShell = async (tenantId: string, domain: string | undefined, ownerEmail: string) => {
    const tenantDomain = domain && domain !== 'localhost' ? domain : undefined;
    try {
      await nativeLoginToLanding({ tenantId, provider: 'openframe', tenantDomain, email: ownerEmail });
    } catch (error) {
      handleNativeSignupLoginFailure(error);
    }
  };

  const handleRegistrationFailure = (error: unknown) => {
    toast({
      title: 'Registration Failed',
      description: error instanceof Error ? error.message : 'Unable to create organization',
      variant: 'destructive',
    });
    setIsLoading(false);
  };

  const submitOrganizationRegistration = async (data: RegisterRequest): Promise<'check-email' | undefined> => {
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
      const body = response.data as { code?: string; message?: string } | undefined;
      const code = body?.code;
      const message = getRecaptchaCheckedFailureMessage(response, 'Registration failed');
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

    if (response.status === SIGNUP_EMAIL_CONFIRMATION_STATUS) {
      setIsLoading(false);
      return 'check-email';
    }

    const tenant = response.data as { id?: string; domain?: string } | undefined;

    // Record the pending signup before any sign-in route can establish the first session.
    markPendingSignup();

    if (!tenant?.id) {
      signInToContinue();
      return undefined;
    }

    if (isAppShell()) {
      // The browser session created by registration is separate from the native session.
      await continueSignupInNativeShell(tenant.id, tenant.domain, data.email);
      return undefined;
    }

    window.location.replace(authApiClient.continueUrl(tenant.id, landingReturnUrl()));
    return undefined;
  };

  const registerOrganization = async (data: RegisterRequest): Promise<'check-email' | undefined> => {
    setIsLoading(true);

    try {
      return await submitOrganizationRegistration(data);
    } catch (error) {
      handleRegistrationFailure(error);
    }
    return undefined;
  };

  const startSsoLogin = async (provider: string, tenant?: SsoLoginTenant | null) => {
    const loginHandle = provider === 'openframe' ? undefined : tenant?.loginHandle;
    const tenantId = loginHandle ? undefined : tenant?.tenantId;
    if (tenantId) {
      setTenantId(tenantId);
    }

    if (isAppShell()) {
      await nativeLoginToLanding({
        tenantId: tenant?.tenantId,
        loginHandle,
        tenantDomain: tenant?.tenantDomain,
        provider,
        email: tenant ? email : undefined,
      });
      return;
    }

    const workspace = readWorkspaceHint(window.location.search);
    window.location.href = tenantId
      ? authApiClient.loginUrl(tenantId, landingReturnUrl(), provider, { workspace })
      : authApiClient.ssoLoginUrl(provider, { loginHandle, workspace });
  };

  /**
   * Signs in through `provider`, into `tenant` when the caller names one. The caller passes the
   * tenant its screen is showing, never one remembered from an earlier lookup: what the button
   * looked like when it was clicked is what it does.
   */
  const loginWithSso = async (provider: string, tenant?: SsoLoginTenant | null) => {
    setIsLoading(true);

    try {
      await startSsoLogin(provider, tenant);
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
          title: loginFailureTitle(error),
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
  }, [clearTokens, setEmail, setTenantInfo, setHasDiscoveredTenants, tenantInfo, queryClient]);

  const reset = () => {
    setEmail('');
    setTenantInfo(null);
    setHasDiscoveredTenants(false);
    setIsLoading(false);
  };

  return {
    email,
    tenantInfo,
    hasDiscoveredTenants,
    isLoading,
    isInitialized,
    discoverTenants,
    registerOrganization,
    loginWithSso,
    logout,
    reset,
  };
}
