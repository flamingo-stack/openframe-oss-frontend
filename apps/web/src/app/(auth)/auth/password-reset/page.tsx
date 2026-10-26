'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { PasswordResetForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ComponentProps, useEffect, useState } from 'react';
import { BackToLoginShell } from '@/app/(auth)/auth/components/standalone-auth-shell';
import { usePasswordPair } from '@/app/(auth)/auth/hooks/use-password-pair';
import { noop } from '@/app/components/shared/no-next-page';
import { authApiClient, getAuthFailureMessage } from '@/lib/auth-api-client';

type ResetFormProps = ComponentProps<typeof PasswordResetForm>;

/** An empty, inert form: what every field reads before the reset token is read. */
const EMPTY_RESET_FORM = {
  password: '',
  confirmPassword: '',
  onPasswordChange: noop,
  onConfirmPasswordChange: noop,
  onSubmit: noop,
  onCancel: noop,
  onBackToLogin: noop,
  submitDisabled: true,
} satisfies ResetFormProps;

/**
 * The password reset screen: the shell, its Back to login footer and the form. One view for the loaded page and the
 * Suspense fallback (empty and inert, in a loading scope), so the two cannot drift.
 */
function PasswordResetView({ form, onBack = noop }: { form?: Partial<ResetFormProps>; onBack?: () => void }) {
  return (
    <BackToLoginShell onBack={onBack}>
      <PasswordResetForm {...EMPTY_RESET_FORM} {...form} />
    </BackToLoginShell>
  );
}

export default function PasswordResetPage() {
  return (
    // `useSearchParams` bails out to the client during the static prerender: the empty form, in a loading scope,
    // stands in until the URL (the reset token) is read.
    <LoadingSuspense label="Loading password reset" fallback={<PasswordResetView />}>
      <PasswordResetContent />
    </LoadingSuspense>
  );
}

function PasswordResetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = searchParams.get('token');

  const { isValid, errors, ...pair } = usePasswordPair();
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

  const handleBack = () => router.push('/auth');

  const handleSubmit = async () => {
    if (!token || !isValid) return;

    setIsLoading(true);

    try {
      const response = await authApiClient.confirmPasswordReset({
        token,
        newPassword: pair.password,
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
    <PasswordResetView
      onBack={handleBack}
      form={{
        ...pair,
        onSubmit: handleSubmit,
        onCancel: handleBack,
        onBackToLogin: handleBack,
        submitDisabled: !isValid,
        loading: isLoading,
        errors,
      }}
    />
  );
}
