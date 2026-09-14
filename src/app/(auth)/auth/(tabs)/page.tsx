'use client';

import AuthPage from '@/app/(auth)/auth/pages/auth-page';
import LoginPage from '@/app/(auth)/auth/pages/login-page';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';

/** `/auth` is Sign Up, except in a login-only mobile build, which has no sign-up to offer. */
export default function AuthRootPage() {
  return useLoginOnlyMobileShell() ? <LoginPage /> : <AuthPage />;
}
