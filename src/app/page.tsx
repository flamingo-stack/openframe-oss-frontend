'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getDefaultRedirectPath } from '../lib/app-mode';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated !== null) {
      router.replace(getDefaultRedirectPath(isAuthenticated));
    }
  }, [router, isAuthenticated]);

  // This route only ever redirects — it holds until the effect above lands on the
  // dashboard or on /auth. A bare app-background screen for both branches, matching
  // the native splash so the handoff doesn't flash anything. It used to draw the
  // full app-shell placeholder on the authenticated branch; that guessed chrome for
  // a page the user never stays on, and the live shell draws its own loading state
  // the moment it mounts.
  return <div className="min-h-screen bg-ods-bg" />;
}
