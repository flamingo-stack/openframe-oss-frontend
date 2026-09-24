// FE-7's `×N` chip: `count` is an unmapped `Long` that may arrive as a string,
// and `null`, 0 and 1 all mean "not repeated" — a `×1` chip must never render.
import { describe, expect, it } from 'vitest';
import { toRepeatCount } from './device-log-count';

describe('toRepeatCount', () => {
  it('renders a repeat badge only above 1, which is FE-7 verbatim', () => {
    expect(toRepeatCount(2)).toBe(2);
    expect(toRepeatCount(1)).toBeNull();
    expect(toRepeatCount(0)).toBeNull();
  });

  it('accepts the string a 64-bit Long is often serialised as', () => {
    expect(toRepeatCount('7')).toBe(7);
    expect(toRepeatCount('1')).toBeNull();
  });

  it('drops anything that is not a finite number', () => {
    expect(toRepeatCount(null)).toBeNull();
    expect(toRepeatCount(undefined)).toBeNull();
    expect(toRepeatCount('')).toBeNull();
    expect(toRepeatCount('many')).toBeNull();
    expect(toRepeatCount(Number.NaN)).toBeNull();
    expect(toRepeatCount(Infinity)).toBeNull();
  });
});
