import { describe, expect, it } from 'vitest';
import { initialAutoTopUpSettingsValues, toWholeDollarsText, validateAutoTopUpSettings } from './auto-top-up-settings';

const MINIMUMS = { minimumAmountUsd: 10, minimumThresholdUsd: 2 };

describe('validateAutoTopUpSettings', () => {
  it('sends all three figures, the limit included', () => {
    expect(validateAutoTopUpSettings({ thresholdUsd: '10', amountUsd: '50', spendLimitUsd: '200' }, MINIMUMS)).toEqual({
      ok: true,
      input: { thresholdUsd: 10, amountUsd: 50, spendLimitUsd: 200 },
    });
  });

  it('reads an empty limit as no limit', () => {
    expect(validateAutoTopUpSettings({ thresholdUsd: '10', amountUsd: '50', spendLimitUsd: '' }, MINIMUMS)).toEqual({
      ok: true,
      input: { thresholdUsd: 10, amountUsd: 50, spendLimitUsd: null },
    });
  });

  it('asks for the threshold and the amount', () => {
    expect(validateAutoTopUpSettings({ thresholdUsd: '', amountUsd: '', spendLimitUsd: '' }, MINIMUMS)).toEqual({
      ok: false,
      errors: { thresholdUsd: 'Enter a threshold.', amountUsd: 'Enter a top-up amount.' },
    });
  });

  it('holds the threshold below the amount', () => {
    const equal = validateAutoTopUpSettings({ thresholdUsd: '50', amountUsd: '50', spendLimitUsd: '' }, MINIMUMS);
    expect(equal).toEqual({
      ok: false,
      errors: { thresholdUsd: 'The threshold must be lower than the top-up amount.' },
    });
    const below = validateAutoTopUpSettings({ thresholdUsd: '49', amountUsd: '50', spendLimitUsd: '' }, MINIMUMS);
    expect(below.ok).toBe(true);
  });

  it('holds the limit at or above one top-up', () => {
    expect(validateAutoTopUpSettings({ thresholdUsd: '10', amountUsd: '50', spendLimitUsd: '49' }, MINIMUMS)).toEqual({
      ok: false,
      errors: { spendLimitUsd: 'The spend limit must be at least the top-up amount.' },
    });
    expect(validateAutoTopUpSettings({ thresholdUsd: '10', amountUsd: '50', spendLimitUsd: '50' }, MINIMUMS).ok).toBe(
      true,
    );
  });

  it('applies the floors the backend states', () => {
    expect(
      validateAutoTopUpSettings(
        { thresholdUsd: '4', amountUsd: '24', spendLimitUsd: '' },
        { minimumAmountUsd: 25, minimumThresholdUsd: 5 },
      ),
    ).toEqual({
      ok: false,
      errors: { amountUsd: 'The minimum top-up is $25.', thresholdUsd: 'The minimum threshold is $5.' },
    });
    expect(
      validateAutoTopUpSettings(
        { thresholdUsd: '5', amountUsd: '25', spendLimitUsd: '' },
        { minimumAmountUsd: 25, minimumThresholdUsd: 5 },
      ).ok,
    ).toBe(true);
  });
});

describe('toWholeDollarsText', () => {
  it('keeps the whole dollars of what was typed or pasted', () => {
    expect(toWholeDollarsText('$50')).toBe('50');
    expect(toWholeDollarsText('50.99')).toBe('50');
    expect(toWholeDollarsText('1,000')).toBe('1000');
  });
});

describe('initialAutoTopUpSettingsValues', () => {
  it('starts from what is saved, and from nothing where nothing is', () => {
    expect(initialAutoTopUpSettingsValues({ thresholdUsd: 10, amountUsd: 50, spendLimitUsd: null })).toEqual({
      thresholdUsd: '10',
      amountUsd: '50',
      spendLimitUsd: '',
    });
  });
});
