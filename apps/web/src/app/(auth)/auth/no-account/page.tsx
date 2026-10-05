'use client';

import { NoAccountNotice } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';

/**
 * Where a login-only mobile build sends an SSO identity that verified but has no OpenFrame account —
 * in place of the organization setup the web continues into at `sso-continue`. Nothing about the
 * identity reaches this route: `useSsoSignupTakeover` drops the Apple credential or signup ticket at
 * capture, and both are single-use and expire on their own.
 */
export default function NoAccountPage() {
  const router = useRouter();

  return <NoAccountNotice onBackToLogin={() => router.replace(routes.auth.login)} />;
}
