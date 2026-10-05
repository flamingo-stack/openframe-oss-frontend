import { describe, expect, it } from 'vitest';
import { SNOOZE_MAX_AMOUNT, snoozeUntil } from './snooze-until';

describe('snoozeUntil', () => {
  const from = new Date('2026-09-16T10:00:00Z');

  it('adds whole hours', () => {
    expect(snoozeUntil(1, 'hour', from).toISOString()).toBe('2026-09-16T11:00:00.000Z');
  });

  it('stays inside the Date range at the cap', () => {
    expect(() => snoozeUntil(SNOOZE_MAX_AMOUNT, 'week').toISOString()).not.toThrow();
  });

  it('adds days and weeks', () => {
    expect(snoozeUntil(2, 'day', from).toISOString()).toBe('2026-09-18T10:00:00.000Z');
    expect(snoozeUntil(1, 'week', from).toISOString()).toBe('2026-09-23T10:00:00.000Z');
  });
});
