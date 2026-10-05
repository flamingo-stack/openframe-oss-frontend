'use client';

import { AuthShell, CompactAuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';

interface StandaloneAuthShellProps {
  children: ReactNode;
  /** Passed through to `AuthShell` (desktop-only there); the compact shell has no footer slot. */
  footer?: ReactNode;
}

/**
 * Shell for the auth pages outside the `(tabs)` group (invite, password reset, their loading state).
 *
 * `AuthShell` shows the marketing benefits panel on narrow screens: "14 day free trial", "No card
 * required", a "Learn More" link to the website. In a login-only mobile build that panel is the
 * sign-up pitch App Review rejected (3.1.1/3.1.3), so these pages take the same compact shell as the
 * login screen there. `AuthShell` cannot simply be told "no benefits" — a nullish `benefits` prop
 * falls back to the default panel.
 */
export function StandaloneAuthShell({ children, footer }: StandaloneAuthShellProps) {
  if (useLoginOnlyMobileShell()) {
    return <CompactAuthShell tagline={null}>{children}</CompactAuthShell>;
  }
  return <AuthShell footer={footer}>{children}</AuthShell>;
}
