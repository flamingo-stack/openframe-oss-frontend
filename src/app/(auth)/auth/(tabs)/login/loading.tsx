'use client';

import { AuthFormSkeleton } from '../../components/auth-page-skeleton';

/** Card-only loading state for /auth/login — the shell and tabs are the layout's and stay put. */
export default function LoginLoading() {
  return <AuthFormSkeleton variant="login" />;
}
