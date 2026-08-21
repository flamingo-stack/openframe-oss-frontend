/**
 * Canonical onboarding step order + counting helpers.
 *
 * The two enums come from the backend schema (`npm run generate-enums`):
 * `TenantOnboardingStep` drives the tenant "Initial Setup" card on the dashboard,
 * `UserOnboardingStep` drives the per-user "Get Started" page. The ordered arrays
 * below are the single source of truth for how many steps each surface has and in
 * what order they render — nothing counts steps by a hardcoded number anymore.
 */
import { TenantOnboardingStep, UserOnboardingStep } from '@/generated/schema-enums';

/**
 * Tenant "Initial Setup" steps, in display order.
 *
 * `COMPANY_TEAM` is gone — the design replaced it with Meet Mingo and the
 * backend enum has dropped it. Its step body is still on disk
 * (`components/company-team-step.tsx`) if it ever comes back.
 */
export const TENANT_ONBOARDING_STEPS: readonly TenantOnboardingStep[] = [
  TenantOnboardingStep.MSP_SETUP,
  TenantOnboardingStep.CUSTOMERS_SETUP,
  TenantOnboardingStep.DEVICE_MANAGEMENT,
  TenantOnboardingStep.MEET_MINGO,
];

/**
 * User "Get Started" steps, in display order.
 *
 * A SUBSET of `UserOnboardingStep`: `CUSTOMERS_SETUP` and `DEVICE_MANAGEMENT`
 * are deliberately absent. Both are tenant Initial Setup steps — by the time
 * this tour is reachable the workspace already has a customer and a device
 * (the tour is gated on `tenant.completed`), so asking a user to redo them was
 * busywork. The backend enum still carries them and a user record may still
 * list them as completed; everything here counts against THIS array, so those
 * extra entries are simply ignored.
 *
 * `as const satisfies` narrows the element type to exactly the steps rendered,
 * which is what lets the step→body map in `onboarding-content` be exhaustive
 * over the tour instead of over the whole enum.
 */
export const USER_ONBOARDING_STEPS = [
  UserOnboardingStep.MEET_MINGO,
  UserOnboardingStep.TICKETS,
  UserOnboardingStep.SCRIPTING,
  UserOnboardingStep.MONITORING,
  UserOnboardingStep.LOGGING,
  UserOnboardingStep.KNOWLEDGE_MANAGEMENT,
] as const satisfies readonly UserOnboardingStep[];

/** The steps the "Get Started" tour actually renders — see the array above. */
export type UserOnboardingStepId = (typeof USER_ONBOARDING_STEPS)[number];

/**
 * DOM id + URL hash fragment for a step's accordion block on /onboarding
 * (`CUSTOMERS_SETUP` → `step-customers-setup`, deep-linked as
 * `/onboarding#step-customers-setup`). Namespaced with `step-` the way the
 * hub namespaces its anchors (`faq-…`, `delivery-…`) so generic step names
 * (`TICKETS` → `tickets`) can't collide with other DOM ids on the page.
 */
export function onboardingStepAnchorId(step: string): string {
  return `step-${step.toLowerCase().replace(/_/g, '-')}`;
}

/** Reverse of {@link onboardingStepAnchorId}, validated against `steps`; unknown fragment → null. */
export function onboardingStepFromAnchorId<T extends string>(steps: readonly T[], anchorId: string): T | null {
  return steps.find(step => onboardingStepAnchorId(step) === anchorId) ?? null;
}

/**
 * Count how many of `steps` appear in `completedSteps` (order-independent).
 *
 * `completedSteps` is a membership oracle (`readonly string[]`), not a step
 * list: a surface renders a SUBSET of its backend enum, so the set that comes
 * back can name steps this surface never shows. `steps` defines the universe.
 */
export function countCompleted(steps: readonly string[], completedSteps: readonly string[]): number {
  const done = new Set(completedSteps);
  return steps.reduce((count, step) => (done.has(step) ? count + 1 : count), 0);
}

/** Whether a given step is in the completed set — same oracle as above. */
export function isStepDone(step: string, completedSteps: readonly string[]): boolean {
  return completedSteps.includes(step);
}
