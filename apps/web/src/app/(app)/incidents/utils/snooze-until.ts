const SNOOZE_UNIT = {
  hour: { label: 'Hour', ms: 60 * 60 * 1000 },
  day: { label: 'Day', ms: 24 * 60 * 60 * 1000 },
  week: { label: 'Week', ms: 7 * 24 * 60 * 60 * 1000 },
} as const;

export type SnoozeUnit = keyof typeof SNOOZE_UNIT;

export const SNOOZE_UNITS = Object.keys(SNOOZE_UNIT) as SnoozeUnit[];

/**
 * Sanity bound on the amount the picker accepts: past this a value is a typo
 * (or a `1e20` the number input let through), not an intent. It also keeps
 * `amount × ms` far inside what `Date` can represent (~14 million weeks), past
 * which `toISOString()` throws instead of snoozing.
 */
export const SNOOZE_MAX_AMOUNT = 999;

export function snoozeUnitLabel(unit: SnoozeUnit): string {
  return SNOOZE_UNIT[unit].label;
}

/** The moment `amount` × `unit` after `from` — when a snoozed incident returns to the working set. */
export function snoozeUntil(amount: number, unit: SnoozeUnit, from: Date = new Date()): Date {
  return new Date(from.getTime() + amount * SNOOZE_UNIT[unit].ms);
}
