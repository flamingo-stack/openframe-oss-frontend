'use client';

import { AuthShell, type AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type LoginDiscoveryResult, LoginSection } from '@/app/(auth)/auth/components/login-form-section';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { isAuthOnlyMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';

// Backend provider id ↔ LoginForm provider id
const SSO_TO_FORM: Record<string, AuthSsoProvider> = {
  // The backend reports the built-in login as 'openframe'; 'openframe-sso' is the legacy id.
  openframe: 'openframe',
  'openframe-sso': 'openframe',
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};
const FORM_TO_SSO: Record<AuthSsoProvider, string> = {
  openframe: 'openframe',
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};
const FORM_PROVIDER_ORDER: AuthSsoProvider[] = ['openframe', 'google', 'microsoft', 'apple'];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { loginWithSso, discoverTenants } = useAuth();

  // Local flag for the SSO redirect only — useAuth's isLoading also toggles on
  // every background discovery and would flicker the whole form.
  const [ssoLoading, setSsoLoading] = useState(false);

  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();
  const formProviders = FORM_PROVIDER_ORDER.filter(provider => provider !== 'apple' || isApple);

  // A tenant can disable the built-in OpenFrame login (Settings > SSO
  // Configurations). Discovery then omits its provider id, and the button must
  // disappear entirely — not just stay locked like the other providers do.
  const [openframeOffered, setOpenframeOffered] = useState(true);
  const visibleProviders = formProviders.filter(provider => provider !== 'openframe' || openframeOffered);

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
  // buttons unlock for the discovered tenant (and OpenFrame hides when the
  // tenant disabled it — see `openframeOffered`).
  const handleDiscover = async (email: string): Promise<LoginDiscoveryResult | null> => {
    const result = await discoverTenants(email);
    if (!result) return null;
    const backendProviders = result.auth_providers || ['openframe'];
    const providers = formProviders.filter(provider => backendProviders.some(id => SSO_TO_FORM[id] === provider));
    // Only an explicit answer for an existing account hides the button; a
    // not-found email restores the default full set.
    setOpenframeOffered(!result.has_existing_accounts || providers.includes('openframe'));
    return {
      found: result.has_existing_accounts,
      providers,
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
        allProviders={visibleProviders}
        isLoading={ssoLoading}
      />
    </AuthShell>
  );
}
