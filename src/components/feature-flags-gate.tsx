'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';
import { AppShellSkeleton } from '@/app/components/app-shell-skeleton';
import { useFeatureFlagsQuery } from '@/app/hooks/use-feature-flags-query';
import { isSaasSharedMode } from '@/lib/app-mode';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

interface FeatureFlagsGateProps {
  children: React.ReactNode;
}

export function FeatureFlagsGate({ children }: FeatureFlagsGateProps) {
  const pathname = usePathname();
  // `/auth/*` and `/` are transient, unauthenticated-safe entry routes: neither
  // carries app chrome, and `/` only redirects. Gating them on the /me check
  // flashes the dashboard skeleton before the redirect resolves — on the web,
  // and (visibly, after the native splash lifts) in the mobile/desktop shells.
  const isAuthRoute = pathname?.startsWith('/auth') ?? false;
  const isRootRoute = pathname === '/';
  const saasShared = isSaasSharedMode();
  const { isReady, isAuthenticated } = useAuthSession();
  const isLoaded = useFeatureFlagsStore(s => s.isLoaded);
  const setLoaded = useFeatureFlagsStore(s => s.setLoaded);

  useFeatureFlagsQuery({ enabled: !saasShared && isReady && isAuthenticated });

  useEffect(() => {
    if (saasShared && !isLoaded) {
      setLoaded();
      return;
    }
    if (isReady && !isAuthenticated && !isLoaded) {
      setLoaded();
    }
  }, [saasShared, isReady, isAuthenticated, isLoaded, setLoaded]);

  if (saasShared) {
    return <>{children}</>;
  }

  // Public auth routes are not gated on the /me session check or feature flags:
  // they carry no flag-gated chrome, and blocking them flashes the full app-shell
  // (fake dashboard) skeleton over the sign-in form for the whole auth round-trip.
  // The auth pages redirect themselves once the session resolves as authenticated.
  // `/` is exempt too so its own redirect placeholder (not this skeleton) shows.
  if (isAuthRoute || isRootRoute) {
    return <>{children}</>;
  }

  if (!isReady || (isAuthenticated && !isLoaded)) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}
