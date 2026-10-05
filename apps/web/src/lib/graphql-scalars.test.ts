import { describe, expect, it } from 'vitest';
import { asInstant, isInstant, parseInstant, parseLocalDate, toInstant } from './graphql-scalars';

describe('Instant', () => {
  it('reads the nanosecond fraction Java prints, which Date alone does not', () => {
    expect(parseInstant('2026-09-23T09:04:26.847000044Z')?.toISOString()).toBe('2026-09-23T09:04:26.847Z');
    expect(parseInstant('2026-09-23T09:04:26.847Z')?.toISOString()).toBe('2026-09-23T09:04:26.847Z');
    expect(parseInstant('2026-09-23T09:04:26Z')?.toISOString()).toBe('2026-09-23T09:04:26.000Z');
  });

  it('rejects what is not an instant', () => {
    expect(parseInstant('yesterday')).toBeNull();
    expect(isInstant('')).toBe(false);
    expect(() => asInstant('2026-13-45')).toThrow(/Not an Instant/);
  });

  it('round-trips a Date through the wire form', () => {
    const date = new Date('2026-09-23T09:04:26.847Z');
    expect(toInstant(date)).toBe('2026-09-23T09:04:26.847Z');
    expect(parseInstant(toInstant(date))?.getTime()).toBe(date.getTime());
  });
});

describe('LocalDate', () => {
  it('reads the day at local midnight, not UTC', () => {
    const day = parseLocalDate('2026-10-15');
    expect([day?.getFullYear(), day?.getMonth(), day?.getDate(), day?.getHours()]).toEqual([2026, 9, 15, 0]);
  });

  it('rejects what is not a day', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-10-15T00:00:00Z')).toBeNull();
  });
});
