'use client';

import {
  type AuthSsoProvider,
  CreateOrganizationForm,
  LoginForm,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useRef, useState } from 'react';
import { DomainSuggestions } from '@/app/(auth)/auth/components/domain-suggestions';
import {
  EMAIL_REGEX,
  INVALID_EMAIL_ERROR,
  MIN_PASSWORD_LENGTH,
  ORG_NAME_ERROR,
  ORG_NAME_REGEX,
  PASSWORD_TOO_SHORT_ERROR,
  PASSWORDS_DO_NOT_MATCH_ERROR,
} from '@/app/(auth)/auth/constants/registration-validation';
import { useOrganizationDomain } from '@/app/(auth)/auth/hooks/use-organization-domain';
import {
  BLOCKED_EMAIL_DOMAIN_MESSAGE,
  useEmailAvailability,
} from '@/app/(auth)/auth/hooks/use-registration-availability';
import { isSharedAuthUi } from '@/lib/app-mode';
import { SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';
import { pushSignupStarted } from '@/lib/posthog/posthog-events';

interface CreateOrganizationSectionProps {
  /**
   * Submits the whole signup in one call. Organization and personal details are collected on the
   * same screen now, so there is no intermediate hand-off through storage.
   */
  onRegister: (payload: {
    orgName: string;
    domain: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) => void;
  /** Provider buttons, rendered above the email field on step one where they need nothing typed. */
  ssoProviders?: AuthSsoProvider[];
  /**
   * Provider sign-up with nothing filled in. Runs the shared SSO login: the server resolves the
   * tenant from the asserted identity and, finding no account, routes to the page that collects
   * the organization — so the provider supplies the identity rather than the form doing it first.
   */
  onSsoLogin?: (provider: AuthSsoProvider) => void;
  isLoading?: boolean;
}

/**
 * Wires the shared forms to the sign-up flow, in two steps on one screen: providers and the email
 * that unlocks the rest, then the organization and account details.
 *
 * Owns the email, organization-name and credential state plus live email availability. The whole
 * subdomain concern — sanitizing, live and submit-time availability, and the tenant-registration
 * capacity case — belongs to `useOrganizationDomain`, shared with the two SSO screens so all three
 * answer it identically. Delegates submission upward.
 */
export function CreateOrganizationSection({
  onRegister,
  ssoProviders,
  onSsoLogin,
  isLoading,
}: CreateOrganizationSectionProps) {
  const isSharedAuth = isSharedAuthUi();

  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Email first, then everything else. The providers above the email need nothing typed, so this
  // step is also the one that keeps them reachable on a cold screen.
  const [step, setStep] = useState<'email' | 'details'>('email');
  // Funnel event, fired once when the user commits to the details step — the "signup started"
  // edge of the password funnel.
  const signupStartedFired = useRef(false);
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isOrgNameValid = ORG_NAME_REGEX.test(organizationName.trim());

  const emailStatus = useEmailAvailability(email);
  const isEmailBlocked = emailStatus === 'taken' || emailStatus === 'blocked' || emailStatus === 'checking';

  const domainField = useOrganizationDomain(organizationName);

  const isOrganizationValid =
    isEmailValid &&
    !isEmailBlocked &&
    isOrgNameValid &&
    !!domainField.domain.trim() &&
    !domainField.isBlocked &&
    agreedToTerms;

  const isPasswordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isDetailsValid =
    isOrganizationValid &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    passwordsMatch;

  const handleSubmit = async () => {
    if (!isDetailsValid || domainField.isChecking) return;
    const tenantDomain = await domainField.confirmAvailability();
    if (!tenantDomain) return;
    onRegister({
      orgName: organizationName.trim(),
      domain: tenantDomain,
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    });
  };

  const emailStatusMessage = !isEmailValid
    ? undefined
    : emailStatus === 'checking'
      ? { message: 'Checking availability…', variant: 'muted' as const }
      : emailStatus === 'taken'
        ? { message: 'This email is already registered. Sign in instead.', variant: 'error' as const }
        : emailStatus === 'blocked'
          ? { message: BLOCKED_EMAIL_DOMAIN_MESSAGE, variant: 'error' as const }
          : emailStatus === 'available'
            ? { message: 'Email is available', variant: 'success' as const }
            : undefined;

  // Step one: providers, then the email that unlocks the rest. Reuses the login shape so both tabs
  // present the same thing on arrival — providers first, email second.
  if (step === 'email') {
    return (
      <LoginForm
        title="Create Organization"
        subtitle="Start your journey with OpenFrame."
        email={email}
        onEmailChange={setEmail}
        loading={isLoading}
        emailStatus={emailStatusMessage}
        ssoProviders={ssoProviders ?? []}
        onSsoClick={provider => onSsoLogin?.(provider)}
        dividerLabel="or enter email to continue with OpenFrame SSO"
        onSubmitClick={() => {
          if (!signupStartedFired.current) {
            signupStartedFired.current = true;
            pushSignupStarted();
          }
          setStep('details');
        }}
        submitLabel="Continue"
        // Waits for the debounced availability check to SETTLE, not merely to be un-blocked: an
        // untouched `idle` also passes `!isEmailBlocked`, and leaving on it strands the user on
        // step two, where the address is read-only and a late `taken` can never be corrected.
        // `error` passes so a failed check does not block signup; the server re-validates anyway.
        submitDisabled={!isEmailValid || emailStatus === 'idle' || emailStatus === 'checking' || isEmailBlocked}
        errors={{ email: email.trim() && !isEmailValid ? INVALID_EMAIL_ERROR : undefined }}
      />
    );
  }

  return (
    <CreateOrganizationForm
      email={email}
      emailReadOnly
      organizationName={organizationName}
      domain={domainField.domain}
      agreedToTerms={agreedToTerms}
      firstName={firstName}
      lastName={lastName}
      password={password}
      confirmPassword={confirmPassword}
      onOrganizationNameChange={setOrganizationName}
      onDomainChange={domainField.setDomain}
      onAgreedToTermsChange={setAgreedToTerms}
      onFirstNameChange={setFirstName}
      onLastNameChange={setLastName}
      onPasswordChange={setPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onSubmit={handleSubmit}
      onBack={() => setStep('email')}
      submitLabel="Create Account"
      submitDisabled={!isDetailsValid}
      loading={isLoading || domainField.isChecking}
      domainSuffix={isSharedAuth ? `.${SAAS_DOMAIN_SUFFIX}` : undefined}
      termsUrl={TERMS_URL}
      privacyPolicyUrl={PRIVACY_POLICY_URL}
      domainStatus={domainField.statusMessage}
      domainSlot={
        domainField.suggestions.length > 0 ? (
          <DomainSuggestions suggestions={domainField.suggestions} onSelect={domainField.setDomain} />
        ) : undefined
      }
      errors={{
        password: isPasswordTooShort ? PASSWORD_TOO_SHORT_ERROR : undefined,
        confirmPassword:
          confirmPassword.length > 0 && password !== confirmPassword ? PASSWORDS_DO_NOT_MATCH_ERROR : undefined,
        organizationName: organizationName.trim() && !isOrgNameValid ? ORG_NAME_ERROR : undefined,
      }}
    />
  );
}
