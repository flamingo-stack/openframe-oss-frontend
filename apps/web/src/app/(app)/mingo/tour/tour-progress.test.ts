import { describe, expect, it } from 'vitest';
import { UserOnboardingStep } from '@/generated/schema-enums';
import { doneTourStepIds } from './tour-progress';

describe('doneTourStepIds', () => {
  it('is empty with no record on either side', () => {
    expect(doneTourStepIds(undefined, undefined).size).toBe(0);
    expect(doneTourStepIds([], []).size).toBe(0);
  });

  it('reads a known step from the server record', () => {
    const done = doneTourStepIds([], [UserOnboardingStep.TICKETS, UserOnboardingStep.LOGGING]);
    expect([...done]).toEqual(['tickets', 'logs']);
  });

  it('reads a step the server does not know from this device', () => {
    const done = doneTourStepIds(['devices', 'incidents'], []);
    expect([...done]).toEqual(['devices', 'incidents']);
  });

  it('counts a known step done on this device before the server answered', () => {
    const done = doneTourStepIds(['scripting'], []);
    expect(done.has('scripting')).toBe(true);
  });

  it('ignores ids that are not tour steps', () => {
    const done = doneTourStepIds(['MEET_MINGO', 'nonsense'], [UserOnboardingStep.MEET_MINGO]);
    expect(done.size).toBe(0);
  });
});
