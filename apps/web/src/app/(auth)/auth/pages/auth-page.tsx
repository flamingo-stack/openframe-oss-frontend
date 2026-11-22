'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { AuthHardeningBoundary } from '@/app/(auth)/auth/components/auth-hardening-boundary';
import { CreateOrganizationSection } from '@/app/(auth)/auth/components/create-organization-section';
import { NativeSsoSignupSection } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { VALID_EMAIL_REGEX } from '@/app/(auth)/auth/constants/registration-validation';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { useSignupEmailPrefill } from '@/app/(auth)/auth/hooks/use-signup-email-prefill';
import { useSsoSignupTakeover } from '@/app/(auth)/auth/hooks/use-sso-signup-takeover';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { routes } from '@/lib/routes';

export default function AuthPage() {
  return <AuthHardeningBoundary>{enabled => <SignupFlow hardeningEnabled={enabled} />}</AuthHardeningBoundary>;
}

function SignupFlow({ hardeningEnabled }: { hardeningEnabled: boolean }) {
  const { isLoading, loginWithSso, registerOrganization } = useAuth(hardeningEnabled);
  const { providers, loading: providersLoading } = useRegistrationProviders();
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  const signup = useSsoSignupTakeover();
  // A handed-over email arrives after hydration: the form is mounted again with it, so its own state starts there.
  const prefill = useSignupEmailPrefill();
  const initialEmail = prefill && VALID_EMAIL_REGEX.test(prefill) ? prefill : undefined;

  // Organization and personal details are collected on one screen now, so the signup lands here
  // directly instead of handing off through sessionStorage to /auth/signup.
  const handleRegister = async (payload: {
    orgName: string;
    domain: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    prNumber?: number;
  }) => {
    const result = await registerOrganization({
      tenantName: payload.orgName,
      tenantDomain: payload.domain,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: payload.password,
      ...(payload.prNumber !== undefined ? { prNumber: payload.prNumber } : {}),
    });
    if (result === 'check-email') setShowEmailConfirmation(true);
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
      <NativeSsoSignupSection
        pending={signup.pending}
        onRegistered={signup.onRegistered}
        onExit={signup.onExit}
        hardeningEnabled={hardeningEnabled}
      />
    );
  }

  if (showEmailConfirmation) {
    return (
      <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">Check your email</h1>
        <p className="text-ods-text-secondary text-h4">
          Look for an email with the next step for your OpenFrame account.
        </p>
        <Button variant="accent" fullWidth href={routes.auth.login}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <CreateOrganizationSection
      hardeningEnabled={hardeningEnabled}
      key={initialEmail ?? ''}
      initialEmail={initialEmail}
      onRegister={handleRegister}
      ssoProviders={ssoProviders}
      ssoProvidersLoading={providersLoading}
      onSsoLogin={handleSsoLogin}
      isLoading={isLoading}
    />
  );
}
