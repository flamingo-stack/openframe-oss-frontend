'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { FetchPolicy } from 'relay-runtime';
import type { tenantOnboardingAutoDetectRelayQuery as AutoDetectQuery } from '@/__generated__/tenantOnboardingAutoDetectRelayQuery.graphql';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import { TENANT_ONBOARDING_STEPS } from '@/app/(app)/onboarding/onboarding-steps';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { tenantOnboardingAutoDetectRelayQuery } from '@/graphql/onboarding/tenant-onboarding-auto-detect-relay';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { apiClient } from '@/lib/api-client';
import { useOnboardingStore } from '@/stores/onboarding-store';

// Device-status filter: only ONLINE/OFFLINE count as "a device connected" — ARCHIVED
// (removed) and PENDING (still enrolling) must NOT auto-complete DEVICE_MANAGEMENT.
// Module-level for a stable reference (see AUTO_DETECT_OPTIONS).
const AUTO_DETECT_VARIABLES = {
  deviceFilter: { statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE] },
};

// `store-and-network`: fetch fresh on every mount (each dashboard visit), then serve the
// Relay store on re-renders WITHOUT re-suspending. The no-re-suspend part is what matters:
// this component also suspends on a sibling TanStack `useSuspenseQuery` (users), and
// `network-only` can thrash (re-suspend/refetch) when a component keeps suspending on
// another source before it commits — store-and-network commits from the store instead.
// (Stable module-level VARS/OPTIONS are belt-and-suspenders — Relay memoizes variables by
// value, so equal-valued inline objects wouldn't refetch on their own — but keep intent
// clear at no cost.)
const AUTO_DETECT_OPTIONS = { fetchPolicy: 'store-and-network' as FetchPolicy };

/**
 * Data-driven auto-completion for the tenant "Initial Setup" steps.
 *
 * ⚠️ TEMPORARY — this whole client-side detect-and-write-back is a stopgap. Completion
 * SHOULD be computed authoritatively by the backend inside `tenantOnboardingProgress`
 * (it already owns customers/devices/users/tenant-profile). Until it does, the frontend
 * polls those counts here and writes the steps back. Known limitations that go away once
 * the backend owns this: steps only auto-close when the user visits the dashboard;
 * thresholds hardcode seeding assumptions (default org, owner); a failed write-back isn't
 * retried until the next visit; the top-bar CTA can briefly lag the card. When the
 * backend lands, delete this hook and read `completedSteps` straight from the store.
 *
 * A step is really done the moment its underlying data exists — the MSP profile is
 * filled, a customer/device/teammate has been added. This hook reads those live
 * counts and, when a step's condition holds but the step isn't yet in the backend
 * `completedSteps`, fires `completeTenantStepInBackground` to persist it.
 *
 * It returns `completedByData` (the steps whose live data already satisfies their
 * criteria) so the card can union it with the backend `completedSteps` for display —
 * a step reads as done immediately, without waiting for the background mutation to
 * round-trip. The backend stays the source of truth: we only WRITE completion.
 *
 * Data fetching:
 *   - The three schema-backed signals (MSP profile, org count, connected-device
 *     count) come from ONE Relay query (`store-and-network`: fetched fresh on every
 *     mount, store-served on re-render), not four separate suspense reads — no request
 *     waterfall, no raw-POST GraphQL.
 *   - The user count is REST (`api/users` `totalElements`, which matches Settings →
 *     Employees; the GraphQL `users` count did not).
 *
 * MUST be called only from a component mounted while onboarding is active (both reads
 * suspend and have no `enabled`/mount gate of their own) and wrapped in a Suspense
 * boundary — see InitialSetupCard, which gates on `!isLoaded || !tenant || completed`.
 *
 * Completion criteria (there is always a default org, hence `> 1` for customers):
 *   - MSP_SETUP:         name + website + logo all filled
 *   - CUSTOMERS_SETUP:   more than one organization (at least one real customer)
 *   - DEVICE_MANAGEMENT: at least one ONLINE/OFFLINE device
 *   - COMPANY_TEAM:      2 or more users (the owner plus at least one teammate)
 */
export function useTenantOnboardingAutoDetect(): Set<TenantOnboardingStep> {
  const tenant = useOnboardingStore(state => state.tenant);
  const { completeTenantStepInBackground } = useOnboardingMutations();

  const data = useLazyLoadQuery<AutoDetectQuery>(
    tenantOnboardingAutoDetectRelayQuery,
    AUTO_DETECT_VARIABLES,
    AUTO_DETECT_OPTIONS,
  );
  const mspComplete = Boolean(
    data.tenantInfo?.name?.trim() && data.tenantInfo?.website?.trim() && data.tenantInfo?.image?.imageUrl?.trim(),
  );
  const orgCount = data.organizations?.filteredCount ?? 0;
  const deviceCount = data.deviceFilters?.filteredCount ?? 0;

  // User count stays REST. `useSuspenseQuery` under the same Suspense boundary; note
  // TanStack clamps suspense staleTime/gcTime to a 1s minimum, so this is effectively
  // "fresh on mount" (refetchOnMount:'always') rather than truly uncached.
  const { data: usersCount = 0 } = useSuspenseQuery({
    queryKey: ['onboarding-auto-detect', 'users-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ totalElements?: number }>('api/users?page=0&size=1');
        return res.ok ? (res.data?.totalElements ?? 0) : 0;
      } catch {
        return 0;
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const completedByData = useMemo(() => {
    const steps = new Set<TenantOnboardingStep>();
    if (mspComplete) {
      steps.add(TenantOnboardingStep.MSP_SETUP);
    }
    if (orgCount > 1) {
      steps.add(TenantOnboardingStep.CUSTOMERS_SETUP);
    }
    if (deviceCount > 0) {
      steps.add(TenantOnboardingStep.DEVICE_MANAGEMENT);
    }
    if (usersCount >= 2) {
      steps.add(TenantOnboardingStep.COMPANY_TEAM);
    }
    return steps;
  }, [mspComplete, orgCount, deviceCount, usersCount]);

  // Steps whose completion mutation we've already sent this mount. Per-mount only —
  // resets on remount, and the next visit re-derives from the backend `completedSteps`.
  const fired = useRef<Set<TenantOnboardingStep>>(new Set());

  // Persist ONE step at a time: fire the first not-yet-persisted, not-yet-fired step;
  // its mutation updates the store (tenant reference changes) which re-runs this effect
  // for the next one. Serializing avoids firing all satisfied steps at once, where the
  // concurrent completeTenantOnboardingStep responses (each returns the full
  // `completedSteps` and overwrites the store, last-write-wins) could clobber a
  // sibling's just-written step.
  useEffect(() => {
    if (!tenant) {
      return;
    }
    const next = TENANT_ONBOARDING_STEPS.find(
      step => completedByData.has(step) && !tenant.completedSteps.includes(step) && !fired.current.has(step),
    );
    if (!next) {
      return;
    }
    fired.current.add(next);
    completeTenantStepInBackground(next);
  }, [tenant, completedByData, completeTenantStepInBackground]);

  return completedByData;
}
