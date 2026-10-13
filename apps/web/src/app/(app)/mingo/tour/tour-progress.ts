import type { UserOnboardingStep } from '@/generated/schema-enums';
import { TOUR_STEPS, type TourStepId } from './tour-steps';

/** Which tour steps the server records as done, as tour step ids. */
export function doneTourStepIds(serverSteps: readonly UserOnboardingStep[] | undefined): ReadonlySet<TourStepId> {
  const done = new Set<TourStepId>();
  for (const step of TOUR_STEPS) {
    if (serverSteps?.includes(step.userStep) ?? false) done.add(step.id);
  }
  return done;
}
