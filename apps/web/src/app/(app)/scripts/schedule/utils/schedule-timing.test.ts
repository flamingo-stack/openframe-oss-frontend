import { fromScheduleInstant } from '@flamingo-stack/openframe-frontend-core/components/features';
import { describe, expect, it } from 'vitest';
import { ScheduleTimeReference } from '@/generated/schema-enums';
import { toScheduleInstant } from './schedule-timing';

/**
 * The wall-clock reading, both directions.
 *
 * DEVICE_LOCAL is the one place in this module where stamping local digits as
 * UTC is CORRECT rather than the bug `toScheduleInstant` was rewritten to fix:
 * the schedule stores a reading each device re-bases into its own zone, so the
 * digits are the payload. The pair below is therefore about what a value SAYS,
 * never about the instant it would name — which is why every assertion is on
 * local components and none of them depends on the timezone the tests run in.
 */
describe('device-local instants', () => {
  const picked = new Date(2026, 8, 10, 9, 0);

  it('stores the picked wall clock verbatim', () => {
    expect(toScheduleInstant(picked, ScheduleTimeReference.DEVICE_LOCAL)).toBe('2026-09-10T09:00:00Z');
  });

  it('round-trips, so seeding the form from a saved schedule shows what was picked', () => {
    const stored = toScheduleInstant(picked, ScheduleTimeReference.DEVICE_LOCAL);
    expect(fromScheduleInstant(stored, ScheduleTimeReference.DEVICE_LOCAL).getTime()).toBe(picked.getTime());
  });

  it('leaves the SERVER reading a real conversion', () => {
    // The instant is preserved rather than the digits — the distinction the two
    // readings exist for. Asserted as a round trip because the STRING differs
    // per zone and only the moment is invariant.
    const stored = toScheduleInstant(picked, ScheduleTimeReference.SERVER);
    expect(new Date(stored).getTime()).toBe(picked.getTime());
    expect(fromScheduleInstant(stored, ScheduleTimeReference.SERVER).getTime()).toBe(picked.getTime());
  });
});
