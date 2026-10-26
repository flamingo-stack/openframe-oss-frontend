import { TenantOnboardingStep } from '@/generated/schema-enums';

/**
 * The setup wizard's screens, in walking order. `welcome` and `all-set` persist
 * nothing; the three in the middle each own one tenant Initial Setup step
 * (`TENANT_STEP_OF`), and `ready` is the landing after the last of them.
 */
export const SETUP_STEPS = ['welcome', 'organization', 'customer', 'device', 'ready', 'all-set'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The screens that persist a tenant step, in walking order - the progress bar's segments. */
export const SETUP_TENANT_SCREENS = ['organization', 'customer', 'device'] as const;
export type SetupTenantScreen = (typeof SETUP_TENANT_SCREENS)[number];

export const TENANT_STEP_OF: Record<SetupTenantScreen, TenantOnboardingStep> = {
  organization: TenantOnboardingStep.MSP_SETUP,
  customer: TenantOnboardingStep.CUSTOMERS_SETUP,
  device: TenantOnboardingStep.DEVICE_MANAGEMENT,
};

function isTenantScreen(step: SetupStep): step is SetupTenantScreen {
  return (SETUP_TENANT_SCREENS as readonly string[]).includes(step);
}

/**
 * What the progress bar paints for a screen: how many segments are done and
 * which one (1-based) is current. `welcome` and `all-set` show an idle bar;
 * `ready` shows it full.
 */
export function setupProgressOf(step: SetupStep): { done: number; current: number | null } {
  if (step === 'ready') return { done: SETUP_TENANT_SCREENS.length, current: null };
  if (!isTenantScreen(step)) return { done: 0, current: null };
  const index = SETUP_TENANT_SCREENS.indexOf(step);
  return { done: index, current: index + 1 };
}

/**
 * The screen after `from`: the first tenant screen past it whose step is not
 * done yet, else `ready`. A step completed earlier (another admin, a previous
 * visit, the data auto-detect) is walked over rather than shown again.
 */
export function nextSetupScreen(from: SetupStep, isDone: (step: TenantOnboardingStep) => boolean): SetupStep {
  const start = isTenantScreen(from) ? SETUP_TENANT_SCREENS.indexOf(from) + 1 : 0;
  const next = SETUP_TENANT_SCREENS.slice(start).find(screen => !isDone(TENANT_STEP_OF[screen]));
  return next ?? 'ready';
}
