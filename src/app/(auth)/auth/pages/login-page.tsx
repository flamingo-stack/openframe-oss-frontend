'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useState } from 'react';
import { type LoginDiscoveryResult, LoginSection } from '@/app/(auth)/auth/components/login-form-section';
import { NativeSsoSignupSection } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useSsoSignupTakeover } from '@/app/(auth)/auth/hooks/use-sso-signup-takeover';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';

// Backend provider id ↔ LoginForm provider id
const SSO_TO_FORM: Record<string, AuthSsoProvider> = {
  // The backend reports the built-in login as 'openframe'; 'openframe-sso' is the legacy id.
  openframe: 'openframe',
  'openframe-sso': 'openframe',
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};
const FORM_PROVIDER_ORDER: AuthSsoProvider[] = ['openframe', 'google', 'microsoft', 'apple'];

export default function LoginPage() {
  const { loginWithSso, discoverTenants } = useAuth();

  // Local flag for the SSO redirect only — useAuth's isLoading also toggles on
  // every background discovery and would flicker the whole form.
  const [ssoLoading, setSsoLoading] = useState(false);
  const signup = useSsoSignupTakeover();

  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();
  const formProviders = FORM_PROVIDER_ORDER.filter(provider => provider !== 'apple' || isApple);

  // Single-screen flow: the email field runs debounced discovery. The external provider buttons
  // need nothing typed and are never gated; discovery decides only whether the OpenFrame email
  // path is offered, which LoginSection resolves from the providers returned here.
  const handleDiscover = async (email: string): Promise<LoginDiscoveryResult | null> => {
    const result = await discoverTenants(email);
    if (!result) return null;
    const backendProviders = result.auth_providers || ['openframe'];
    const providers = formProviders.filter(provider => backendProviders.some(id => SSO_TO_FORM[id] === provider));
    return {
      found: result.has_existing_accounts,
      providers,
    };
  };

  const handleSso = async (provider: AuthSsoProvider) => {
    setSsoLoading(true);
    try {
      await loginWithSso(provider);
    } catch (error) {
      // Not a failure: the Apple identity verified but has no account, so the organization form
      // takes over in place. Every other error was already surfaced inside loginWithSso.
      // No account yet — from either the Apple sheet or a browser flow: the organization form takes
      // over this screen. Every other error was already surfaced inside loginWithSso.
      signup.capture(error);
    } finally {
      setSsoLoading(false);
    }
  };

  // The tab selector stays visible (the shell owns it), so leaving this screen is possible and
  // discards the pending identity — the same thing the form's Back action does deliberately.
  if (signup.pending) {
    return (
      <NativeSsoSignupSection pending={signup.pending} onRegistered={signup.onRegistered} onExit={signup.onExit} />
    );
  }

  return (
    <LoginSection onDiscover={handleDiscover} onSso={handleSso} allProviders={formProviders} isLoading={ssoLoading} />
  );
}
