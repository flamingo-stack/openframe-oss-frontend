'use client';

import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * Single source of truth for whether the tenant "Initial Setup" onboarding is ACTIVE —
 * i.e. its three surfaces MUST all be showing together: the yellow top bar
 * ({@link ../../../components/initial-setup-bar}), the dashboard dimming overlay, and the
 * Initial Setup card ({@link ../components/initial-setup-card}). Lighting up the bar +
 * overlay without the card (or vice-versa) is the inconsistency this predicate exists to
 * prevent — before it, each surface derived its own condition and they drifted.
 *
 * Active ⟺ onboarding progress has loaded AND we actually have a tenant progress
 * record AND it isn't completed yet.
 *
 * The `!!tenant` guard is the crucial part: `refreshOnboardingProgress` marks the store
 * loaded even on a failed/empty fetch (tenant stays `null`). Treating a null tenant as
 * "not completed" (as `tenant?.completed ?? false` did) lit the bar + dimming while the
 * card — which correctly renders nothing on a null tenant — stayed hidden. Requiring a real
 * tenant record keeps all three in lockstep.
 *
 * NOTE: the card additionally lingers in its completed "victory" state for the session
 * (see InitialSetupCard's latch), so the card can still be visible when this returns false.
 * That asymmetry is intentional; the guarantee here is only the other direction — whenever
 * this is `true`, the card is showing too (its content or its Suspense skeleton).
 */
export function useInitialSetupActive(): boolean {
  const isLoaded = useOnboardingStore(state => state.isLoaded);
  const tenant = useOnboardingStore(state => state.tenant);
  return isLoaded && !!tenant && !tenant.completed;
}
