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

  // saas-shared never fetches flags (auth-only surface) — mark them terminally
  // loaded so isLoaded consumers don't wait forever. Signed-out sessions are
  // deliberately NOT marked: the render below never blocks unauthenticated
  // users on flags anyway, and a loaded-with-empty-flags marker set while
  // signed out survives into the post-login render — the gate then skips its
  // block and the app paints with env-fallback flags (missing header icons,
  // disabled drawer actions) before the real flags arrive, invisible to the
  // non-reactive featureFlags.*.enabled() reads.
  useEffect(() => {
    if (saasShared && !isLoaded) {
      setLoaded();
    }
  }, [saasShared, isLoaded, setLoaded]);

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
