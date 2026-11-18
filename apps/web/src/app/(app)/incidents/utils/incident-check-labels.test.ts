import { describe, expect, it } from 'vitest';
import { formatParameterValue, formatThreshold } from './incident-check-labels';

describe('formatThreshold', () => {
  it('says which side fires, in the unit', () => {
    expect(formatThreshold(10, 'PERCENT', 'BELOW')).toBe('Below 10%');
    expect(formatThreshold(30, 'DAYS', 'ABOVE')).toBe('Above 30 days');
    expect(formatThreshold(40, 'COUNT', 'ABOVE')).toBe('Above 40');
  });

  it("is the bare value for an old incident's threshold, which the API cannot describe", () => {
    expect(formatThreshold(5, null, null)).toBe('5');
  });
});

describe('formatParameterValue', () => {
  it('says one day', () => {
    expect(formatParameterValue(1, 'DAYS')).toBe('1 day');
  });
});
