'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getDefaultRedirectPath } from '../lib/app-mode';
import { AppShellSkeleton } from './components/app-shell-skeleton';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated !== null) {
      router.replace(getDefaultRedirectPath(isAuthenticated));
    }
  }, [router, isAuthenticated]);

  // Only pre-render the app-shell skeleton when we're heading into the app.
  // An unauthenticated boot redirects to /auth, so show a bare app-background
  // screen instead — matching the native splash so its handoff to the sign-in
  // page doesn't flash the dashboard chrome.
  return isAuthenticated ? <AppShellSkeleton /> : <div className="min-h-screen bg-ods-bg" />;
}
