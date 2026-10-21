'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { BackToLoginLink, PasswordResetForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { StandaloneAuthShell } from '@/app/(auth)/auth/components/standalone-auth-shell';
import { getPasswordError } from '@/app/(auth)/auth/constants/registration-validation';
import { authApiClient, getAuthFailureMessage } from '@/lib/auth-api-client';

const noop = () => {};

export default function PasswordResetPage() {
  return (
    // `useSearchParams` bails out to the client during the static prerender: the empty form, in a loading scope,
    // stands in until the URL (the reset token) is read.
    <Suspense
      fallback={
        <LoadingFallback label="Loading password reset">
          <StandaloneAuthShell>
            <PasswordResetForm
              password=""
              confirmPassword=""
              onPasswordChange={noop}
              onConfirmPasswordChange={noop}
              onSubmit={noop}
              onCancel={noop}
              onBackToLogin={noop}
              submitDisabled
            />
          </StandaloneAuthShell>
        </LoadingFallback>
      }
    >
      <PasswordResetContent />
    </Suspense>
  );
}

function PasswordResetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({
        title: 'Invalid Reset Link',
        description: 'No reset token provided. Please use the link from your password reset email.',
        variant: 'destructive',
      });
      router.push('/auth');
    }
  }, [token, router, toast]);

  const passwordError = getPasswordError(password);
  const isMismatch = !!confirmPassword && password !== confirmPassword;
  const isValid = !passwordError && password === confirmPassword;

  const handleBack = () => router.push('/auth');

  const handleSubmit = async () => {
    if (!token || !isValid) return;

    setIsLoading(true);

    try {
      const response = await authApiClient.confirmPasswordReset({
        token,
        newPassword: password,
      });

      if (!response.ok) {
        throw new Error(getAuthFailureMessage(response, 'Failed to reset password'));
      }

      toast({
        title: 'Password Reset Successful!',
        description: 'Your password has been updated. Redirecting to login...',
        variant: 'success',
      });

      setTimeout(() => {
        router.push('/auth');
      }, 2000);
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: 'Reset Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to reset password. Please try again or request a new reset link.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StandaloneAuthShell footer={<BackToLoginLink onClick={handleBack} />}>
      <PasswordResetForm
        password={password}
        confirmPassword={confirmPassword}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSubmit}
        onCancel={handleBack}
        onBackToLogin={handleBack}
        submitDisabled={!isValid}
        loading={isLoading}
        errors={{
          password: password ? passwordError : undefined,
          confirmPassword: isMismatch ? 'Passwords do not match' : undefined,
        }}
      />
    </StandaloneAuthShell>
  );
}
