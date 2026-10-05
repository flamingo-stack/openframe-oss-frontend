'use client';

import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';
import { AuthFormSkeleton } from '../components/auth-page-skeleton';

/** Card-only loading state for /auth — the shell and tabs are the layout's and stay put. */
export default function AuthLoading() {
  // A login-only mobile build renders the login card at /auth, so it waits on that card's skeleton.
  return <AuthFormSkeleton variant={useLoginOnlyMobileShell() ? 'login' : 'signup'} />;
}
