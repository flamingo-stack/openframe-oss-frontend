import { describe, expect, it } from 'vitest';
import { dayPartOf, greetingFor } from './greeting';

describe('dayPartOf', () => {
  it.each([
    [0, 'Morning'],
    [11, 'Morning'],
    [12, 'Afternoon'],
    [17, 'Afternoon'],
    [18, 'Evening'],
    [23, 'Evening'],
  ] as const)('hour %i is %s', (hour, part) => {
    expect(dayPartOf(hour)).toBe(part);
  });
});

describe('greetingFor', () => {
  it('names the user by first name', () => {
    expect(greetingFor(9, 'Ann')).toBe('Morning, Ann');
    expect(greetingFor(13, ' Ann ')).toBe('Afternoon, Ann');
    expect(greetingFor(20, 'Ann')).toBe('Evening, Ann');
  });

  it('greets nobody in particular without a first name', () => {
    expect(greetingFor(9, undefined)).toBe('Good morning');
    expect(greetingFor(13, null)).toBe('Good afternoon');
    expect(greetingFor(20, '   ')).toBe('Good evening');
  });
});
