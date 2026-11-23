'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useSyncExternalStore } from 'react';
import { CreateOrganizationSection } from '@/app/(auth)/auth/components/create-organization-section';
import { NativeSsoSignupSection } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { VALID_EMAIL_REGEX } from '@/app/(auth)/auth/constants/registration-validation';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { useSignupEmailPrefill } from '@/app/(auth)/auth/hooks/use-signup-email-prefill';
import { useSsoSignupTakeover } from '@/app/(auth)/auth/hooks/use-sso-signup-takeover';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { openSignupInBrowser, signupContinuesInBrowser } from '@/lib/signup-in-browser';

const noSubscription = () => () => {};

export default function AuthPage() {
  const { isLoading, loginWithSso, registerOrganization } = useAuth();
  const { providers, loading: providersLoading } = useRegistrationProviders();

  const signup = useSsoSignupTakeover();
  // A handed-over email arrives after hydration: the form is mounted again with it, so its own state starts there.
  const prefill = useSignupEmailPrefill();
  const initialEmail = prefill && VALID_EMAIL_REGEX.test(prefill) ? prefill : undefined;
  // The static export prerenders this page with no shell, so the answer waits for hydration; a document never changes
  // shell, so nothing is subscribed.
  const inBrowser = useSyncExternalStore(noSubscription, signupContinuesInBrowser, () => false);

  // Organization and personal details are collected on one screen now, so the signup lands here
  // directly instead of handing off through sessionStorage to /auth/signup.
  const handleRegister = (payload: {
    orgName: string;
    domain: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    prNumber?: number;
  }) => {
    registerOrganization({
      tenantName: payload.orgName,
      tenantDomain: payload.domain,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: payload.password,
      ...(payload.prNumber !== undefined ? { prNumber: payload.prNumber } : {}),
    });
  };

  // External providers offered by the backend for registration; Apple only on Apple devices. While the backend's
  // answer is read, the form holds a box for every provider it may offer.
  const isApple = useIsApplePlatform();
  const offerable: AuthSsoProvider[] = (['google', 'microsoft', 'apple'] as const).filter(
    provider => provider !== 'apple' || isApple,
  );
  const ssoProviders = providersLoading
    ? offerable
    : offerable.filter(provider => providers.some(sp => sp.provider === provider));

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
      key={initialEmail ?? ''}
      initialEmail={initialEmail}
      onRegister={handleRegister}
      ssoProviders={ssoProviders}
      ssoProvidersLoading={providersLoading}
      onSsoLogin={handleSsoLogin}
      isLoading={isLoading}
      onContinueInBrowser={inBrowser ? openSignupInBrowser : undefined}
    />
  );
}
