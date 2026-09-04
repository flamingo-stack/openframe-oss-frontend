import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTimeSlotOptions } from './schedule-timing';

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
});
