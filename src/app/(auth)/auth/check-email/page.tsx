'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authApiClient } from '@/lib/auth-api-client';
import { routes } from '@/lib/routes';

/**
 * "Check your Email" confirmation page shown right after a successful email
 * registration. The address comes from the signup flow's sessionStorage — a
 * direct visit without it has nothing to confirm, so it falls back to /auth.
 */
export default function CheckEmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  // Read in an effect (not during render) so the SSR and first client render
  // match — both render null until the address is known.
  const [email, setEmail] = useState('');

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('auth:email');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.replace(routes.auth.root);
    }
  }, [router]);

  if (!email) return null;

  const handleResend = async () => {
    setIsResending(true);

    try {
      const response = await authApiClient.resendVerificationEmail(email);

      if (!response.ok) {
        const error = response.data as { code?: string; message?: string } | undefined;
        throw new Error(error?.message || response.error || 'Failed to resend the confirmation email');
      }

      toast({
        title: 'Email Sent',
        description: `We sent a new confirmation link to ${email}.`,
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Resend Failed',
        description:
          error instanceof Error ? error.message : 'Failed to resend the confirmation email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-[var(--spacing-system-xl)]">
      {/* Logo */}
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenFrameLogo
          className="h-10 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      {/* Content */}
      <main className="flex max-w-[600px] flex-col items-center gap-[var(--spacing-system-xl)] text-center">
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <h1 className="text-ods-text-primary text-h2">Check your Email</h1>
          <p className="text-ods-text-secondary text-h4">
            We sent a confirmation link to <span className="text-ods-text-primary">{email}</span>. Click it to verify
            your address and finish setting up your account.
          </p>
        </div>

        {/* 200px per the mockup, shrinking evenly when the viewport is narrower than the design's 430px frame */}
        <div className="flex w-full justify-center gap-[var(--spacing-system-m)]">
          <Button variant="outline" className="w-full max-w-[200px]" onClick={() => router.push(routes.auth.root)}>
            Back to Sign Up
          </Button>
          <Button variant="outline" className="w-full max-w-[200px]" onClick={handleResend} disabled={isResending}>
            {isResending ? 'Sending...' : 'Resend Email'}
          </Button>
        </div>

        <p className="text-ods-text-secondary text-h6">
          Didn&apos;t get it? Check your spam folder. The link expires in 24 hours.
        </p>
      </main>

      {/* Footer */}
      <footer>
        <a
          href="https://flamingo.run"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[var(--spacing-system-xsf)] rounded-md bg-transparent p-[var(--spacing-system-mf)] text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
        >
          <span className="text-h6">Powered by</span>
          <FlamingoLogo className="h-5 w-5" fill="currentColor" />
          <span className="font-semibold text-code">Flamingo</span>
        </a>
      </footer>
    </div>
  );
}
