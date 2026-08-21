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

// `store-and-network`: fresh on every mount (each dashboard visit), then store-served on
// re-render WITHOUT re-suspending. `network-only` can thrash when a component keeps
// suspending before it commits.
const AUTO_DETECT_OPTIONS = { fetchPolicy: 'store-and-network' as FetchPolicy };

/**
 * The steps this hook has a rule for — i.e. the only ones whose completion is a FACT
 * about the workspace rather than a claim by the user, and therefore the only ones a
 * step gate can be built on (see `StepMeta.requiresData` in the Initial Setup card).
 * `MEET_MINGO` is absent because no count answers "has met Mingo"; enumerated
 * positively so a future undetectable step can't silently become gateable.
 */
export type DataDetectableStep =
  | typeof TenantOnboardingStep.MSP_SETUP
  | typeof TenantOnboardingStep.CUSTOMERS_SETUP
  | typeof TenantOnboardingStep.DEVICE_MANAGEMENT;

/**
 * Data-driven auto-completion for the tenant "Initial Setup" steps: a step is done the
 * moment its underlying data exists, so this reads the live signals and persists any
 * step the backend doesn't have yet via `completeTenantStepInBackground`.
 *
 * ⚠️ TEMPORARY — completion SHOULD be computed by the backend inside
 * `tenantOnboardingProgress`, which already owns all of this data. Until it is, steps
 * only close when the user visits the dashboard and a failed write-back waits for the
 * next visit. When the backend lands, delete this hook and read `completedSteps`
 * straight from the store.
 *
 * Returns `completedByData` so the card can union it with the persisted set for display
 * (a step reads as done without waiting for the round-trip) and gate its locked steps on
 * it (`StepMeta.requiresData`) — which is why this set must stay a statement about the
 * workspace's data and never absorb what the user merely checked off.
 *
 * MUST be called from a component mounted only while onboarding is active and wrapped in
 * a Suspense boundary — the read suspends and has no mount gate of its own. See
 * InitialSetupCard.
 *
 * Criteria:
 *   - MSP_SETUP:         name + website + logo all filled
 *   - CUSTOMERS_SETUP:   at least one organization that is not the default one
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
  // "A customer exists" is one NON-DEFAULT organization — not a count. Counting
  // had to assume the workspace was seeded with a default org and subtract it
  // (`> 1`), so a tenant without that seed needed TWO customers before the step
  // would close, and the Device Management gate stayed locked with one. Reading
  // `isDefault` asks the question directly and holds either way.
  const hasCustomer = (data.organizations?.edges ?? []).some(edge => edge?.node?.isDefault === false);
  const deviceCount = data.deviceFilters?.filteredCount ?? 0;

  const completedByData = useMemo(() => {
    const steps = new Set<TenantOnboardingStep>();
    if (mspComplete) {
      steps.add(TenantOnboardingStep.MSP_SETUP);
    }
    if (hasCustomer) {
      steps.add(TenantOnboardingStep.CUSTOMERS_SETUP);
    }
    if (deviceCount > 0) {
      steps.add(TenantOnboardingStep.DEVICE_MANAGEMENT);
    }
    // No rule for Meet Mingo — "has met Mingo" is not a fact any query answers.
    return steps;
  }, [mspComplete, hasCustomer, deviceCount]);

  // Steps whose completion mutation we've already sent this mount. Per-mount only —
  // resets on remount, and the next visit re-derives from the backend `completedSteps`.
  const fired = useRef<Set<TenantOnboardingStep>>(new Set());

  // ONE step at a time: each mutation returns the full `completedSteps` and overwrites
  // the store, so concurrent writes would clobber each other. The store update re-runs
  // this effect for the next step.
  useEffect(() => {
    if (!tenant) {
      return;
    }
    // With every step done the card commits the WHOLE onboarding in the background. A
    // per-step write racing that lands `completed: false` on top of it and the onboarding
    // chrome then only clears on a reload — and it is redundant anyway.
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
