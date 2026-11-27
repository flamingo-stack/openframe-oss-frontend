import { describe, expect, it } from 'vitest';
import {
  formatParameterValue,
  formatRunsEvery,
  formatThreshold,
  joinThresholds,
  thresholdScopeLabel,
} from './check-labels';

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

describe('joinThresholds', () => {
  it('reads as one phrase', () => {
    expect(joinThresholds(['Below 80%', 'Above 1000'])).toBe('Below 80% or above 1000');
    expect(joinThresholds(['Below 10%'])).toBe('Below 10%');
  });
});

describe('thresholdScopeLabel', () => {
  it('names the scope an incident threshold came from', () => {
    expect(thresholdScopeLabel('DEFAULT', null)).toBe('Default · all devices');
    expect(thresholdScopeLabel('GLOBAL', null)).toBe('Default · all devices');
    expect(thresholdScopeLabel('TAG', 'kiosk')).toBe('Tag · kiosk');
    expect(thresholdScopeLabel('CUSTOMER', 'Acme')).toBe('Customer · Acme');
    expect(thresholdScopeLabel('DEVICE', null)).toBe('Device');
  });
});

describe('formatRunsEvery', () => {
  it('uses the largest whole unit', () => {
    expect(formatRunsEvery(3600)).toBe('1 h');
    expect(formatRunsEvery(900)).toBe('15 min');
    expect(formatRunsEvery(172800)).toBe('2 d');
  });
});
