'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getDefaultRedirectPath } from '../lib/app-mode';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated === null) return undefined;

    // Carry the query string and hash over: ad traffic lands on the bare root as
    // `/?fbclid=…&utm_source=…&__hstc=…#distinct_id=…`, and GTM (HubSpot, Meta,
    // GA) and the PostHog bootstrap only read them after this redirect — on /auth.
    const target = () => `${getDefaultRedirectPath(isAuthenticated)}${window.location.search}${window.location.hash}`;
    router.replace(target());

    // The GTM PostHog tag strips `#distinct_id` with `history.replaceState({}, …)`.
    // Landing mid-transition, that empty state wipes the router's tree and the
    // navigation above is dropped: a blank page stuck on `/`. Fall back to a hard
    // navigation if we are still here.
    const fallback = window.setTimeout(() => {
      if (window.location.pathname === '/') window.location.replace(target());
    }, 1500);
    return () => window.clearTimeout(fallback);
  }, [router, isAuthenticated]);

  // This route only ever redirects — it holds until the effect above lands on the
  // dashboard or on /auth. A bare app-background screen for both branches, matching
  // the native splash so the handoff doesn't flash anything. It used to draw the
  // full app-shell placeholder on the authenticated branch; that guessed chrome for
  // a page the user never stays on, and the live shell draws its own loading state
  // the moment it mounts.
  return <div className="min-h-screen bg-ods-bg" />;
}
