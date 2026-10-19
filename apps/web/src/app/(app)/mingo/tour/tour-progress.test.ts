import { describe, expect, it } from 'vitest';
import { UserOnboardingStep } from '@/generated/schema-enums';
import { doneTourStepIds } from './tour-progress';

describe('doneTourStepIds', () => {
  it('is empty with no record', () => {
    expect(doneTourStepIds(undefined).size).toBe(0);
    expect(doneTourStepIds([]).size).toBe(0);
  });

  it('maps the server record to tour step ids, in tour order', () => {
    const done = doneTourStepIds([
      UserOnboardingStep.LOGGING,
      UserOnboardingStep.DEVICES,
      UserOnboardingStep.INCIDENTS,
    ]);
    expect([...done]).toEqual(['devices', 'logs', 'incidents']);
  });

  it('ignores steps that are not part of the tour', () => {
    expect(doneTourStepIds([UserOnboardingStep.MEET_MINGO]).size).toBe(0);
  });
});
