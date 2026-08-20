'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { FetchPolicy } from 'relay-runtime';
import type { tenantOnboardingAutoDetectRelayQuery as AutoDetectQuery } from '@/__generated__/tenantOnboardingAutoDetectRelayQuery.graphql';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import { TENANT_ONBOARDING_STEPS } from '@/app/(app)/onboarding/onboarding-steps';
import { TenantOnboardingStep } from '@/generated/schema-enums';
import { tenantOnboardingAutoDetectRelayQuery } from '@/graphql/onboarding/tenant-onboarding-auto-detect-relay';
import { useOnboardingMutations } from '@/graphql/onboarding/use-onboarding-mutations';
import { useOnboardingStore } from '@/stores/onboarding-store';

// Device-status filter: only ONLINE/OFFLINE count as "a device connected" — ARCHIVED
// (removed) and PENDING (still enrolling) must NOT auto-complete DEVICE_MANAGEMENT.
// Module-level for a stable reference (see AUTO_DETECT_OPTIONS).
const AUTO_DETECT_VARIABLES = {
  deviceFilter: { statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE] },
};

// `store-and-network`: fetch fresh on every mount (each dashboard visit), then serve the
// Relay store on re-renders WITHOUT re-suspending. `network-only` can thrash
// (re-suspend/refetch) when a component keeps suspending before it commits —
// store-and-network commits from the store instead.
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
 *
 * MUST be called only from a component mounted while onboarding is active (the read
 * suspends and has no `enabled`/mount gate of its own) and wrapped in a Suspense
 * boundary — see InitialSetupCard, which gates on `!isLoaded || !tenant || completed`.
 *
 * Completion criteria (there is always a default org, hence `> 1` for customers):
 *   - MSP_SETUP:         name + website + logo all filled
 *   - CUSTOMERS_SETUP:   more than one organization (at least one real customer)
 *   - DEVICE_MANAGEMENT: at least one ONLINE/OFFLINE device
 *   - MEET_MINGO:        nothing to detect — the visitor marks it done
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
    // No rule for Meet Mingo: "has met Mingo" is not a fact any count can
    // answer, so that step is completed by the visitor, not detected. The
    // COMPANY_TEAM rule that used to live here went with the step — the write
    // loop below only ever fires steps in TENANT_ONBOARDING_STEPS, so keeping
    // it would have been a REST round-trip on every dashboard load feeding a
    // set entry nothing reads.
    return steps;
  }, [mspComplete, orgCount, deviceCount]);

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
    // Once every step is done (backend-persisted ∪ satisfied by live data), the Initial
    // Setup card commits the WHOLE onboarding in the background (`completeTenantInBackground`
    // → `completed: true`). Firing per-step writes here too races it: each
    // `completeTenantOnboardingStep` response carries `completed: false` and, landing AFTER
    // the whole-onboarding write, clobbers the store back to `false` (last-write-wins) — so
    // the onboarding chrome only clears on a reload, never on navigation. Defer to that single
    // completion write; per-step persistence is redundant the moment all steps are done.
    const allDone = TENANT_ONBOARDING_STEPS.every(
      step => tenant.completedSteps.includes(step) || completedByData.has(step),
    );
    if (allDone) {
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
