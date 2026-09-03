import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleTimeReference } from '@/generated/schema-enums';
import { fromScheduleInstant, getTimeSlotOptions, isSlotOnGrid, toScheduleInstant } from './schedule-timing';

/**
 * The Time dropdown's option list, pinned around the one condition the form
 * branches on: an EMPTY list.
 *
 * `ScheduleTimingFields` reads emptiness as "today, and its last slot has gone
 * by" and puts `NO_SLOTS_TODAY_MESSAGE` on the Date field off the back of it. So
 * the cases below are not really about counting slots — they are about the three
 * other days that must never produce an empty list, because each of them would
 * turn that message into a lie.
 *
 * Times are built from LOCAL components (`new Date(y, m, d, h, min)`), never
 * from a UTC string: the slot grid is local by construction (see
 * `slotBaseMinutes`), so a fixed instant would test a different hour of the day
 * in every timezone CI happens to run in.
 */
describe('getTimeSlotOptions', () => {
  const day = { year: 2026, month: 0, date: 15 } as const;

  function freezeAt(hours: number, minutes: number): void {
    vi.setSystemTime(new Date(day.year, day.month, day.date, hours, minutes));
  }

  const today = () => new Date(day.year, day.month, day.date);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('empties today once the last slot has gone by — the dead end the form names', () => {
    // 23:59 is past the last slot on every grid the offsets produce (23:30 on a
    // whole-hour zone, 23:45 on a 45-minute one).
    freezeAt(23, 59);
    expect(getTimeSlotOptions(today())).toEqual([]);
  });

  it('keeps today usable while slots remain, offering only the ones still ahead', () => {
    freezeAt(12, 0);
    const slots = getTimeSlotOptions(today());
    expect(slots.length).toBeGreaterThan(0);
    // Every option is later than now, which is what makes the list saveable.
    expect(slots.every(slot => slot.value > '12:00')).toBe(true);
  });

  it('keeps the full day for a LATER day, even at one minute to midnight', () => {
    freezeAt(23, 59);
    const tomorrow = new Date(day.year, day.month, day.date + 1);
    expect(getTimeSlotOptions(tomorrow)).toHaveLength(48);
  });

  it('keeps the full day for a PAST day, so a stored start stays readable', () => {
    freezeAt(23, 59);
    const yesterday = new Date(day.year, day.month, day.date - 1);
    expect(getTimeSlotOptions(yesterday)).toHaveLength(48);
  });

  it('keeps the full day when no date is picked yet', () => {
    freezeAt(23, 59);
    expect(getTimeSlotOptions(null)).toHaveLength(48);
    expect(getTimeSlotOptions()).toHaveLength(48);
  });

  it('offers the plain half-hour grid for a device-local start, in any zone', () => {
    freezeAt(0, 0);
    const tomorrow = new Date(day.year, day.month, day.date + 1);
    const slots = getTimeSlotOptions(tomorrow, ScheduleTimeReference.DEVICE_LOCAL);
    // The digits themselves are what gets stored, so they — not the instant they
    // would name — have to sit on the backend's boundary. In a 45-minute zone
    // this is the grid the SERVER reading cannot use, and vice versa.
    expect(slots).toHaveLength(48);
    expect(slots.every(slot => slot.value.endsWith(':00') || slot.value.endsWith(':30'))).toBe(true);
  });
});

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

  it('reads a stored wall clock back as the same reading', () => {
    const restored = fromScheduleInstant('2026-09-10T09:00:00Z', ScheduleTimeReference.DEVICE_LOCAL);
    expect([restored.getFullYear(), restored.getMonth(), restored.getDate()]).toEqual([2026, 8, 10]);
    expect([restored.getHours(), restored.getMinutes()]).toEqual([9, 0]);
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

  it('grades a slot against the grid its own reading uses', () => {
    expect(isSlotOnGrid('09:30', ScheduleTimeReference.DEVICE_LOCAL)).toBe(true);
    // Which is what the Timezone control checks before keeping a picked time: a
    // 45-minute zone's SERVER slots read xx:15 / xx:45 and cannot survive the
    // switch.
    expect(isSlotOnGrid('09:15', ScheduleTimeReference.DEVICE_LOCAL)).toBe(false);
  });
});
