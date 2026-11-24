import { describe, expect, it } from 'vitest';
import { selectorRowColumns } from './selector-row-columns';

describe('selectorRowColumns', () => {
  it('gives Remote Access Permission a floor wide enough for its one-line label, and the platform tabs their own width', () => {
    expect(selectorRowColumns(true)).toBe(
      'content-lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1.5fr)_auto_minmax(0,1fr)]',
    );
  });

  it('has three columns when the Remote Access selector is hidden', () => {
    expect(selectorRowColumns(false)).toBe('content-lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
  });
});
