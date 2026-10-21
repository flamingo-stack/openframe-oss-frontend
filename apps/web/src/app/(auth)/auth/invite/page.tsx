'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type AuthSsoProvider,
  BackToLoginLink,
  CompleteAccountForm,
  InviteLinkInvalidModal,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { StandaloneAuthShell } from '@/app/(auth)/auth/components/standalone-auth-shell';
import {
  getPasswordError,
  isValidPersonName,
  normalizePersonName,
  PERSON_NAME_ERROR,
} from '@/app/(auth)/auth/constants/registration-validation';
import { useInviteProviders } from '@/app/(auth)/auth/hooks/use-invite-providers';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useIsApplePlatform } from '@/app/hooks/use-apple-platform';
import { authApiClient, getAuthFailureMessage } from '@/lib/auth-api-client';

// Backend provider id ↔ form provider id (external providers only)
const SSO_TO_FORM: Record<string, AuthSsoProvider> = {
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
};

function isInvalidInviteError(error: string | null): boolean {
  return !!error && (error.includes('Invitation not found') || error.includes('Invitation already used or revoked'));
}

const noop = () => {};

export default function InvitePage() {
  return (
    // `useSearchParams` bails out to the client during the static prerender: the empty form, in a loading scope,
    // stands in until the URL (the invitation id) is read.
    <Suspense
      fallback={
        <LoadingFallback label="Loading your invitation">
          <StandaloneAuthShell>
            <CompleteAccountForm
              firstName=""
              lastName=""
              password=""
              confirmPassword=""
              onFirstNameChange={noop}
              onLastNameChange={noop}
              onPasswordChange={noop}
              onConfirmPasswordChange={noop}
              onSubmit={noop}
              ssoProviders={[]}
              onSsoClick={noop}
              title="Accept Invitation"
              subtitle="Complete your registration to join the organization"
              submitLabel="Create Account"
              submitDisabled
              loading
            />
          </StandaloneAuthShell>
        </LoadingFallback>
      }
    >
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get('id');

  const { providers, loading, error } = useInviteProviders(invitationId);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTenantSwitch, setShowTenantSwitch] = useState(false);

  // "Continue with Apple" is offered on Apple devices only.
  const isApple = useIsApplePlatform();

  const handleBack = () => router.push('/auth');

  const passwordError = getPasswordError(password);
  const isMismatch = !!confirmPassword && password !== confirmPassword;
  const isValid =
    isValidPersonName(firstName) && isValidPersonName(lastName) && !passwordError && password === confirmPassword;

  const handleSubmit = async (switchTenant = false) => {
    if (!invitationId || !isValid) return;

    setIsSubmitting(true);
    try {
      const response = await authApiClient.acceptInvitation({
        invitationId,
        firstName: normalizePersonName(firstName),
        lastName: normalizePersonName(lastName),
        password,
        switchTenant,
      });

      if (!response.ok) {
        const errorData = response.data as { code?: string; message?: string } | undefined;

        // Already active elsewhere — confirm the tenant switch, then retry.
        if (errorData?.code === 'USER_IS_ACTIVE_IN_ANOTHER_TENANT') {
          setShowTenantSwitch(true);
          setIsSubmitting(false);
          return;
        }

        throw new Error(getAuthFailureMessage(response, 'Failed to accept invitation'));
      }

      toast({
        title: 'Invitation Accepted!',
        description: 'Your account has been created successfully. Redirecting to login...',
        variant: 'success',
      });

      setTimeout(() => {
        router.push('/auth');
      }, 2000);
    } catch (err) {
      console.error('Invitation acceptance error:', err);
      toast({
        title: 'Acceptance Failed',
        description: err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSso = (provider: AuthSsoProvider) => {
    if (!invitationId || provider === 'openframe') return;

    setIsSubmitting(true);
    try {
      // Redirects the browser; acceptInvitationSso passes the provider through in the URL.
      void authApiClient.acceptInvitationSso({
        invitationId,
        provider,
        switchTenant: true,
        redirectTo: '/auth/login',
      });
    } catch (err) {
      console.error('SSO signup error:', err);
      toast({
        title: 'SSO Signup Failed',
        description: 'Unable to initiate SSO signup. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  // Expired / already-used / missing link → dedicated notice.
  if (!invitationId || isInvalidInviteError(error)) {
    return <InviteLinkInvalidModal onBackToLogin={handleBack} />;
  }

  const formProviders: AuthSsoProvider[] = (['google', 'microsoft', 'apple'] as const).filter(
    provider => (provider !== 'apple' || isApple) && providers.some(sp => SSO_TO_FORM[sp.provider] === provider),
  );

  return (
    <StandaloneAuthShell footer={<BackToLoginLink onClick={handleBack} />}>
      <CompleteAccountForm
        firstName={firstName}
        lastName={lastName}
        password={password}
        confirmPassword={confirmPassword}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={() => handleSubmit()}
        ssoProviders={formProviders}
        onSsoClick={handleSso}
        title="Accept Invitation"
        subtitle="Complete your registration to join the organization"
        submitLabel="Create Account"
        submitDisabled={!isValid}
        loading={loading || isSubmitting}
        errors={{
          firstName: firstName.trim() && !isValidPersonName(firstName) ? PERSON_NAME_ERROR : undefined,
          lastName: lastName.trim() && !isValidPersonName(lastName) ? PERSON_NAME_ERROR : undefined,
          password: password ? passwordError : undefined,
          confirmPassword: isMismatch ? 'Passwords do not match' : undefined,
        }}
      />

      <ConfirmDialog
        open={showTenantSwitch}
        onOpenChange={setShowTenantSwitch}
        title="Switch Organization?"
        description="You are already registered in another organization. Would you like to switch to this new organization?"
        confirmLabel="Yes, Switch Organization"
        variant="default"
        onConfirm={() => handleSubmit(true)}
      />
    </StandaloneAuthShell>
  );
}
