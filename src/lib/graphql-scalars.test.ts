import { describe, expect, it } from 'vitest';
import { asInstant, isInstant, parseInstant, toInstant } from './graphql-scalars';

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
