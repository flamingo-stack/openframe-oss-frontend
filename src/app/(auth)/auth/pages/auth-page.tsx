'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { CreateOrganizationSection } from '@/app/(auth)/auth/components/create-organization-section';
import { NativeSsoSignupSection } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { useSsoSignupTakeover } from '@/app/(auth)/auth/hooks/use-sso-signup-takeover';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';

export default function AuthPage() {
  const { isLoading, loginWithSso, registerOrganization } = useAuth();
  const { providers } = useRegistrationProviders();

  const signup = useSsoSignupTakeover();

  // Organization and personal details are collected on one screen now, so the signup lands here
  // directly instead of handing off through sessionStorage to /auth/signup.
  const handleRegister = (payload: {
    orgName: string;
    domain: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) => {
    registerOrganization({
      tenantName: payload.orgName,
      tenantDomain: payload.domain,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: payload.password,
    });
  };

  // External providers offered by the backend for registration; Apple only on Apple devices.
  const isApple = useIsApplePlatform();
  const ssoProviders: AuthSsoProvider[] = (['google', 'microsoft', 'apple'] as const).filter(
    provider => (provider !== 'apple' || isApple) && providers.some(sp => sp.provider === provider),
  );

  // Signing up with Apple is the expected case on this tab, so the no-account answer must land
  // here too — not just on Login. Without the catch the rethrow from loginWithSso becomes an
  // unhandled rejection and the single-use authorization code is lost with no UI at all.
  const handleSsoLogin = async (provider: AuthSsoProvider) => {
    try {
      await loginWithSso(provider);
    } catch (error) {
      // Not a failure: the identity verified, it just has no organization yet.
      // No account yet — from either the Apple sheet or a browser flow: the organization form takes
      // over this screen. Every other error was already surfaced inside loginWithSso.
      signup.capture(error);
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
    <CreateOrganizationSection
      onRegister={handleRegister}
      ssoProviders={ssoProviders}
      onSsoLogin={handleSsoLogin}
      isLoading={isLoading}
    />
  );
}
