'use client';

import { AuthShell, type AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type LoginDiscoveryResult, LoginSection } from '@/app/(auth)/auth/components/login-form-section';
import { resolveAuthError } from '@/app/(auth)/auth/constants/auth-error-codes';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { isAuthOnlyMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';

// Backend provider id ↔ LoginForm provider id
const SSO_TO_FORM: Record<string, AuthSsoProvider> = {
  'openframe-sso': 'openframe',
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};
const FORM_TO_SSO: Record<AuthSsoProvider, string> = {
  openframe: 'openframe-sso',
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};
const FORM_PROVIDER_ORDER: AuthSsoProvider[] = ['openframe', 'google', 'microsoft', 'apple'];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { loginWithSso, discoverTenants } = useAuth();

  // A failed SSO callback can bounce back here with the raw code as `?error=`.
  // Surface it so the return is not silent.
  const rawCallbackError = searchParams.get('error');
  const callbackError = rawCallbackError ? resolveAuthError(rawCallbackError).description : undefined;

  // Local flag for the SSO redirect only — useAuth's isLoading also toggles on
  // every background discovery and would flicker the whole form.
  const [ssoLoading, setSsoLoading] = useState(false);

  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();
  const formProviders = FORM_PROVIDER_ORDER.filter(provider => provider !== 'apple' || isApple);

  useEffect(() => {
    if (isAuthenticated && !isAuthOnlyMode()) {
      // replace, not push: an authenticated user landing on /auth/login (e.g. via
      // back) is redirected without leaving the login screen in the back stack —
      // no flash, no back-loop. Pairs with the replace at login success.
      router.replace(routes.dashboard);
    }
  }, [isAuthenticated, router]);

  // Warm the Sign Up tab's chunk so switching tabs (a router.replace, which unlike
  // <Link> isn't auto-prefetched) swaps the form instantly instead of flashing
  // the route loading skeleton.
  useEffect(() => {
    router.prefetch(routes.auth.root);
  }, [router]);

  // Single-screen flow: the email field runs debounced discovery; provider
  // buttons are always visible and unlock for the discovered tenant.
  const handleDiscover = async (email: string): Promise<LoginDiscoveryResult | null> => {
    const result = await discoverTenants(email);
    if (!result) return null;
    const backendProviders = result.auth_providers || ['openframe-sso'];
    return {
      found: result.has_existing_accounts,
      providers: formProviders.filter(provider => backendProviders.some(id => SSO_TO_FORM[id] === provider)),
    };
  };

  const handleSso = async (provider: AuthSsoProvider) => {
    setSsoLoading(true);
    try {
      await loginWithSso(FORM_TO_SSO[provider]);
    } finally {
      setSsoLoading(false);
    }
  };

  const tabs = (
    <TabSelector
      value="login"
      onValueChange={value => {
        if (value === 'signup') router.replace(routes.auth.root);
      }}
      variant="primary"
      items={[
        { id: 'signup', label: 'Sign Up' },
        { id: 'login', label: 'Login' },
      ]}
    />
  );

  return (
    <AuthShell tabs={tabs}>
      <LoginSection
        onDiscover={handleDiscover}
        onSso={handleSso}
        allProviders={formProviders}
        isLoading={ssoLoading}
        callbackError={callbackError}
      />
    </AuthShell>
  );
}
