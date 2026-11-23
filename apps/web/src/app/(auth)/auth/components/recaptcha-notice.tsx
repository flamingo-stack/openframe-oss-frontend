'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useSyncExternalStore } from 'react';
import { isRecaptchaEnabled } from '@/lib/recaptcha';

const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';
const GOOGLE_TERMS_URL = 'https://policies.google.com/terms';

const subscribe = () => () => undefined;

/**
 * Google's required wording in place of the hidden badge (`globals.css`), verbatim. Only where a token is sent;
 * the server render draws nothing, so hydration matches.
 */
export function RecaptchaNotice({ className }: { className?: string }) {
  const enabled = useSyncExternalStore(subscribe, isRecaptchaEnabled, () => false);
  if (!enabled) return null;

  return (
    <p className={cn('mt-[var(--spacing-system-m)] text-ods-text-muted text-h6', className)}>
      This site is protected by reCAPTCHA and the Google{' '}
      <a href={GOOGLE_PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
        Privacy Policy
      </a>{' '}
      and{' '}
      <a href={GOOGLE_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline">
        Terms of Service
      </a>{' '}
      apply.
    </p>
  );
}
