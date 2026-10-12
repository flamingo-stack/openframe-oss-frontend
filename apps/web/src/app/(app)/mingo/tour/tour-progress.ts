import type { UserOnboardingStep } from '@/generated/schema-enums';
import { TOUR_STEPS, type TourStepId } from './tour-steps';

/**
 * Which tour steps are done: the server's record for the steps
 * `UserOnboardingStep` knows, this device's for the rest - and either for a
 * known step, so a chip used before the server answered still counts.
 */
export function doneTourStepIds(
  localSteps: readonly string[] | undefined,
  serverSteps: readonly UserOnboardingStep[] | undefined,
): ReadonlySet<TourStepId> {
  const done = new Set<TourStepId>();
  for (const step of TOUR_STEPS) {
    const onServer = step.userStep !== null && (serverSteps?.includes(step.userStep) ?? false);
    if (onServer || (localSteps?.includes(step.id) ?? false)) done.add(step.id);
  }
  return done;
}
