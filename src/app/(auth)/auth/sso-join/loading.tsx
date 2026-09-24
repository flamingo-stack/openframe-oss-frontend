'use client';

import { AuthFormSkeleton } from '@/app/(auth)/auth/components/auth-page-skeleton';
import { SsoJoinCardLayout } from '@/app/(auth)/auth/components/sso-join-card-layout';

/** Route-level loading state for /auth/sso-join - the same standalone card the page shows while the identity loads. */
export default function SsoJoinLoading() {
  return (
    <SsoJoinCardLayout>
      <AuthFormSkeleton variant="sso-join" />
    </SsoJoinCardLayout>
  );
}
