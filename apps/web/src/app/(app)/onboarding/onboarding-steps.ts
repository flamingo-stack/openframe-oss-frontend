/**
 * Canonical onboarding step order + counting helpers. The arrays below are the
 * single source of truth for how many steps each surface has and in what order
 * they render; nothing counts steps by a hardcoded number.
 */
import type { ReactNode, Ref } from 'react';
import { TenantOnboardingStep, UserOnboardingStep } from '@/generated/schema-enums';

/** Tenant "Initial Setup" steps, in display order. */
export const TENANT_ONBOARDING_STEPS: readonly TenantOnboardingStep[] = [
  TenantOnboardingStep.MSP_SETUP,
  TenantOnboardingStep.CUSTOMERS_SETUP,
  TenantOnboardingStep.DEVICE_MANAGEMENT,
  TenantOnboardingStep.MEET_MINGO,
];

/**
 * User "Get Started" steps, in display order — a deliberate SUBSET of
 * `UserOnboardingStep`. The tour is gated on `tenant.completed`, so by the time
 * it is reachable the workspace already has a customer and a device; a user
 * record may still list those steps, and everything here counts against this
 * array, so the extras are ignored.
 *
 * `as const satisfies` narrows the element type to exactly the rendered steps,
 * which is what lets the step→body map in `onboarding-content` be exhaustive
 * over the tour rather than the whole enum.
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
 * DOM id + URL hash for a step's accordion block on /onboarding (`TICKETS` →
 * `step-tickets`). Namespaced so generic step names can't collide with other
 * ids on the page.
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
 * `completedSteps` is a membership oracle, not a step list — it can name steps
 * this surface never shows; `steps` defines the universe.
 */
export function countCompleted(steps: readonly string[], completedSteps: readonly string[]): number {
  const done = new Set(completedSteps);
  return steps.reduce((count, step) => (done.has(step) ? count + 1 : count), 0);
}

/** Whether a given step is in the completed set — same oracle as above. */
export function isStepDone(step: string, completedSteps: readonly string[]): boolean {
  return completedSteps.includes(step);
}

/** Where a surface's steps stand: how many, how many done, the one that says "Next", and whether all are done. */
export interface OnboardingProgress<T extends string> {
  total: number;
  done: number;
  nextStep: T | null;
  /** Every step done — never while progress is read (`loading`). */
  allDone: boolean;
}

/** The progress of `steps` against `completedSteps`, one rule for every onboarding surface. */
export function onboardingProgress<T extends string>(
  steps: readonly T[],
  completedSteps: readonly string[],
  loading = false,
): OnboardingProgress<T> {
  const total = steps.length;
  const done = countCompleted(steps, completedSteps);
  return {
    total,
    done,
    // First step still to do, in display order.
    nextStep: steps.find(step => !isStepDone(step, completedSteps)) ?? null,
    allDone: !loading && done >= total,
  };
}

/** No step completed: what a surface's view reads while progress is read. */
export const NO_COMPLETED_STEPS: readonly string[] = [];

/** How a loaded row is wired: its anchor, its expansion and its body. Absent while progress is read. */
export interface OnboardingStepWiring {
  ref: Ref<HTMLDivElement>;
  /** The URL-hash anchor (`/onboarding#step-…`); surfaces without deep-linking omit it. */
  id?: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  body: ReactNode;
}

/** The lead of a surface's progress line: its static step count. */
export function stepsToCompleteLabel(total: number): string {
  return `${total} steps to complete`;
}

/** A surface's progress line, once progress is read: the step count and how many are done, or that all are. */
export function progressLine({ total, done, allDone }: OnboardingProgress<string>): string {
  return allDone ? 'All steps complete' : `${stepsToCompleteLabel(total)} · ${done}/${total} done`;
}
