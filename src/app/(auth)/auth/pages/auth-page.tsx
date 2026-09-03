'use client';

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useRouter } from 'next/navigation';
import { AppleNativeSignupSection } from '@/app/(auth)/auth/components/apple-native-signup-section';
import { CreateOrganizationSection } from '@/app/(auth)/auth/components/create-organization-section';
import { useAppleSignupTakeover } from '@/app/(auth)/auth/hooks/use-apple-signup-takeover';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { SsoRegistrationRequiredError } from '@/lib/native-login';
import { routes } from '@/lib/routes';

export default function AuthPage() {
  const router = useRouter();
  const { isLoading, loginWithSso, registerOrganization } = useAuth();
  const { providers } = useRegistrationProviders();

  const appleSignup = useAppleSignupTakeover();

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
      // No account yet: finish the signup on our own screen instead of in the browser sheet.
      if (error instanceof SsoRegistrationRequiredError) {
        router.replace(`${routes.auth.ssoContinue}?signupTicket=${encodeURIComponent(error.signupTicket)}`);
        return;
      }
      appleSignup.capture(error);
    }
  };

  // The tab selector stays visible (the shell owns it), so leaving this screen is possible and
  // discards the credential — the same thing "Back to sign in" does deliberately.
  if (appleSignup.credential) {
    return (
      <AppleNativeSignupSection
        credential={appleSignup.credential}
        onRegistered={appleSignup.onRegistered}
        onExit={appleSignup.onExit}
      />
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
