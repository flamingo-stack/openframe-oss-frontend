import { describe, expect, it } from 'vitest';
import { formatParameterValue, formatThreshold, parameterPresentation } from './incident-check-labels';

describe('formatThreshold', () => {
  it('says which side fires, in the unit', () => {
    expect(formatThreshold(10, 'PERCENT', 'below')).toBe('Below 10%');
    expect(formatThreshold(30, 'DAYS', 'above')).toBe('Above 30 days');
    expect(formatThreshold(40, 'COUNT', 'above')).toBe('Above 40');
  });

  it('is the bare value for a parameter with no known side or unit', () => {
    expect(formatThreshold(5, null, null)).toBe('5');
  });
});

describe('formatParameterValue', () => {
  it('says one day', () => {
    expect(formatParameterValue(1, 'DAYS')).toBe('1 day');
  });
});

describe('parameterPresentation', () => {
  it('names every parameter of the built-in catalog', () => {
    for (const key of ['freePercent', 'minHealthPercent', 'maxCycles', 'maxStartupItems', 'maxDays']) {
      expect(parameterPresentation(key).comparison).not.toBeNull();
    }
  });
});
