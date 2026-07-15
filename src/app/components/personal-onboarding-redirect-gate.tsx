'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useRelayEnvironment } from 'react-relay';
import { fetchOnboardingProgress } from '@/graphql/onboarding/onboarding-progress-relay';
import { consumePersonalOnboardingRedirectPending } from '@/lib/onboarding-login-redirect';
import { routes } from '@/lib/routes';

/**
 * Sends the user to the personal "Get Started" onboarding exactly ONCE right
 * after login, when it's still unfinished. Renders nothing. Mounted in the app
 * shell only when the `new-onboarding` flag is on (alongside the progress
 * hydrator), so it never runs while the feature is off.
 *
 * The decision is made against a FRESH backend fetch (`fetchOnboardingProgress`,
 * network-only), never the client store snapshot — so a user who logs into a
 * different tenant is redirected based on that tenant's real state, not a stale
 * mirror from the previous session.
 *
 * Conditions (all required):
 *   - a login queued the redirect (`consumePersonalOnboardingRedirectPending`),
 *   - the tenant Initial Setup is complete — personal onboarding is only
 *     reachable afterwards (mirrors the `/onboarding` page's own tenant guard),
 *   - the user hasn't completed or skipped their personal onboarding,
 *   - we're not already on `/onboarding` (avoid a redundant self-navigation).
 *
 * The `handledRef` guard makes this strictly one-shot per mount — it survives the
 * React StrictMode dev double-invoke (a ref persists across the remount), so the
 * flag is consumed and the fetch fired exactly once.
 */
export function PersonalOnboardingRedirectGate() {
  const router = useRouter();
  const environment = useRelayEnvironment();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    // One-shot: only proceed when THIS login queued a redirect. Reading clears it.
    if (!consumePersonalOnboardingRedirectPending()) return;
    handledRef.current = true;

    // Already on the onboarding page (e.g. an onboarding return URL) — nothing to do.
    if (window.location.pathname.startsWith('/onboarding')) return;

    // Backend is the source of truth for the current session/tenant.
    void fetchOnboardingProgress(environment).then(progress => {
      if (!progress) return;
      const userInProgress = !progress.user.completed && !progress.user.skipped;
      if (progress.tenant.completed && userInProgress) {
        router.replace(routes.onboarding);
      }
    });
  }, [environment, router]);

  return null;
}
