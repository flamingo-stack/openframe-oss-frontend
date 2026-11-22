'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useState, useSyncExternalStore } from 'react';
import { AuthHardeningBoundary } from '@/app/(auth)/auth/components/auth-hardening-boundary';
import { ForgotPasswordModal } from '@/app/(auth)/auth/components/forgot-password-modal';
import {
  type LoginDiscoveryResult,
  LoginSection,
  toLoginDiscoveryResult,
} from '@/app/(auth)/auth/components/login-form-section';
import { NativeSsoSignupSection } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { type SsoLoginTenant, useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useSsoSignupTakeover } from '@/app/(auth)/auth/hooks/use-sso-signup-takeover';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';

const GENERIC_PROVIDERS: AuthSsoProvider[] = ['google', 'microsoft', 'apple'];
const subscribeToLink = () => () => {};

function hasPasswordResetLink() {
  return new URLSearchParams(window.location.search).get('forgotPassword') === '1';
}

function PasswordResetFromLink() {
  const requested = useSyncExternalStore(subscribeToLink, hasPasswordResetLink, () => false);
  const [dismissed, setDismissed] = useState(false);
  return <ForgotPasswordModal open={requested && !dismissed} onOpenChange={open => setDismissed(!open)} />;
}

export default function LoginPage() {
  return <AuthHardeningBoundary>{enabled => <SignInFlow hardeningEnabled={enabled} />}</AuthHardeningBoundary>;
}

function SignInFlow({ hardeningEnabled }: { hardeningEnabled: boolean }) {
  const { loginWithSso, discoverTenants } = useAuth(hardeningEnabled);

  // Local flag for the SSO redirect only — useAuth's isLoading also toggles on
  // every background discovery and would flicker the whole form.
  const [ssoLoading, setSsoLoading] = useState(false);
  const signup = useSsoSignupTakeover();
  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();
  const genericProviders = GENERIC_PROVIDERS.filter(provider => provider !== 'apple' || isApple);

  // Single-screen flow: the email field runs debounced discovery, and its answer decides which
  // sign-in methods LoginSection offers under the field.
  const handleDiscover = async (email: string): Promise<LoginDiscoveryResult | null> => {
    const result = await discoverTenants(email);
    return result ? toLoginDiscoveryResult(result) : null;
  };

  const handleSso = async (provider: AuthSsoProvider, tenant: SsoLoginTenant | null) => {
    setSsoLoading(true);
    try {
      await loginWithSso(provider, tenant);
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
      <NativeSsoSignupSection
        pending={signup.pending}
        onRegistered={signup.onRegistered}
        onExit={signup.onExit}
        hardeningEnabled={hardeningEnabled}
      />
    );
  }

  return (
    <>
      <LoginSection
        hardeningEnabled={hardeningEnabled}
        onDiscover={handleDiscover}
        onSso={handleSso}
        genericProviders={genericProviders}
        isLoading={ssoLoading}
      />
      {hardeningEnabled && <PasswordResetFromLink />}
    </>
  );
}
