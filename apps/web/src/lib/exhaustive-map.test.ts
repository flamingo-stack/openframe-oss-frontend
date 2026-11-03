import { describe, expect, it } from 'vitest';
import { knownValue, knownValues, presentationFor } from './exhaustive-map';

const LABELS = { ACTIVE: 'Active', SUSPENDED: 'Suspended' } satisfies Record<'ACTIVE' | 'SUSPENDED', string>;

const Status = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;

describe('presentationFor', () => {
  it('answers a key of the map', () => {
    expect(presentationFor(LABELS, 'SUSPENDED')).toBe('Suspended');
  });

  it('has no answer for a key the map does not have, or none', () => {
    expect(presentationFor(LABELS, 'ARCHIVED')).toBeUndefined();
    expect(presentationFor(LABELS, null)).toBeUndefined();
    expect(presentationFor(LABELS, undefined)).toBeUndefined();
  });

  it('has no answer for a key the map only inherits, as a hand-edited URL could send', () => {
    expect(presentationFor(LABELS, 'toString')).toBeUndefined();
    expect(presentationFor(LABELS, 'constructor')).toBeUndefined();
    expect(presentationFor(LABELS, '__proto__')).toBeUndefined();
    expect(presentationFor(LABELS, 'hasOwnProperty')).toBeUndefined();
  });
});

describe('knownValue', () => {
  it('narrows a value of the enum and drops any other', () => {
    expect(knownValue(Status, 'ACTIVE')).toBe('ACTIVE');
    expect(knownValue(Status, 'ARCHIVED')).toBeNull();
    expect(knownValue(Status, 'toString')).toBeNull();
    expect(knownValue(Status, null)).toBeNull();
  });
});

describe('knownValues', () => {
  it('keeps the values of the enum in their order, duplicates included, and drops the rest', () => {
    expect(knownValues(Status, ['SUSPENDED', 'ARCHIVED', 'ACTIVE', '__proto__', 'SUSPENDED'])).toEqual([
      'SUSPENDED',
      'ACTIVE',
      'SUSPENDED',
    ]);
    expect(knownValues(Status, [])).toEqual([]);
  });
});
