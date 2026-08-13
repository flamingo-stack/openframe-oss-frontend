'use client';

import {
  AuthShell,
  type AuthSsoProvider,
  CompleteAccountForm,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Input, TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/(auth)/auth/hooks/use-auth';
import { useRegistrationProviders } from '@/app/(auth)/auth/hooks/use-registration-providers';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { isAuthOnlyMode, isSharedAuthUi } from '@/lib/app-mode';
import { pushSignupStarted } from '@/lib/posthog/posthog-events';
import { routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';

const MIN_PASSWORD_LENGTH = 8;

/**
 * "Complete your Account" step: name + password for the organization collected
 * on the Create Organization step, or an external SSO provider shortcut.
 */
export default function SignupPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isLoading, registerOrganization, registerOrganizationSso } = useAuth();
  const { providers, loading: loadingProviders } = useRegistrationProviders();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const showPrNumber = runtimeEnv.prNumberEnabled();

  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();

  const storedOrgName = typeof window !== 'undefined' ? sessionStorage.getItem('auth:org_name') || '' : '';
  const storedDomain = typeof window !== 'undefined' ? sessionStorage.getItem('auth:domain') || '' : '';
  const storedEmail = typeof window !== 'undefined' ? sessionStorage.getItem('auth:email') || '' : '';

  // Funnel event: fire once when the signup form actually renders (all org
  // details present — i.e. not a bounced direct visit that redirects away).
  const signupStartedFired = useRef(false);
  useEffect(() => {
    if (signupStartedFired.current) return;
    if (storedOrgName && storedDomain && storedEmail) {
      signupStartedFired.current = true;
      pushSignupStarted();
    }
  }, [storedOrgName, storedDomain, storedEmail]);

  useEffect(() => {
    if (isAuthenticated && !isAuthOnlyMode()) {
      // replace, not push: keep the signup screen out of the back stack so
      // native/browser back can't return to it after a successful signup.
      router.replace(routes.dashboard);
    }
  }, [isAuthenticated, router]);

  // This screen only completes the Create Organization step — without the org
  // details from it (direct URL visit, expired/stale sessionStorage) there is
  // nothing to register, so send the user back to the form.
  useEffect(() => {
    if (!storedOrgName || !storedDomain || !storedEmail) {
      router.replace(routes.auth.root);
    }
  }, [storedOrgName, storedDomain, storedEmail, router]);

  if (!storedOrgName || !storedDomain || !storedEmail) return null;

  const isTooShort = !!password && password.length < MIN_PASSWORD_LENGTH;
  const isMismatch = !!confirmPassword && password !== confirmPassword;
  const isValid =
    !!firstName.trim() && !!lastName.trim() && password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  const handleSubmit = () => {
    if (!isValid) return;
    registerOrganization({
      tenantName: storedOrgName,
      tenantDomain: storedDomain,
      email: storedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      ...(showPrNumber && prNumber ? { prNumber: Number(prNumber) } : {}),
    });
  };

  // External providers offered by the backend for registration; Apple only on Apple devices.
  const formProviders: AuthSsoProvider[] = (['google', 'microsoft', 'apple'] as const).filter(
    provider => (provider !== 'apple' || isApple) && providers.some(sp => sp.provider === provider),
  );

  const handleSso = (provider: AuthSsoProvider) => {
    if (provider === 'openframe') return;
    void registerOrganizationSso({
      tenantName: storedOrgName,
      tenantDomain: storedDomain,
      email: storedEmail,
      provider,
      redirectTo: '/auth/login',
    });
  };

  const tabs = (
    <TabSelector
      value="signup"
      onValueChange={value => {
        if (value === 'login') router.replace(routes.auth.login);
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
      <CompleteAccountForm
        firstName={firstName}
        lastName={lastName}
        password={password}
        confirmPassword={confirmPassword}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSubmit}
        onBack={() => router.push(routes.auth.root)}
        ssoProviders={formProviders}
        onSsoClick={handleSso}
        submitLabel={isSharedAuthUi() ? 'Start Free Trial' : 'Create Organization'}
        submitDisabled={!isValid}
        loading={isLoading || loadingProviders}
        errors={{
          password: isTooShort ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters` : undefined,
          confirmPassword: isMismatch ? 'Passwords do not match' : undefined,
        }}
      >
        {showPrNumber && (
          <Input
            label="PR Number (optional)"
            placeholder="Enter PR Number"
            inputMode="numeric"
            value={prNumber}
            disabled={isLoading || loadingProviders}
            // Digits only — typing or pasting anything else (minus sign included) is stripped.
            onChange={event => setPrNumber(event.target.value.replace(/\D/g, ''))}
          />
        )}
      </CompleteAccountForm>
    </AuthShell>
  );
}
