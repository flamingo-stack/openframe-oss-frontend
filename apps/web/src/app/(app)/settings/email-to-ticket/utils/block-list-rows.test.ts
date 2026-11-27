import { describe, expect, it } from 'vitest';
import { blockListRowOfField, blockListRowsOf, blockListValues } from './block-list-rows';

describe('blockListValues', () => {
  it('sends each value without the spaces around it, blank rows dropped', () => {
    expect(blockListValues([{ value: ' a.com' }, { value: '  ' }, { value: 'x@b.com ' }])).toEqual([
      'a.com',
      'x@b.com',
    ]);
  });
});

describe('blockListRowOfField', () => {
  const rows = [{ value: 'a.com' }, { value: '' }, { value: 'b.com' }];

  it('finds the row of a refused value, counting the values sent', () => {
    expect(blockListRowOfField(rows, 'blockList.0')).toBe(0);
    expect(blockListRowOfField(rows, 'blockList.1')).toBe(2);
  });

  it('answers null for another field or an index past the list', () => {
    expect(blockListRowOfField(rows, 'defaultStatusId')).toBeNull();
    expect(blockListRowOfField(rows, 'blockList.5')).toBeNull();
    expect(blockListRowOfField(rows, null)).toBeNull();
  });
});

describe('blockListRowsOf', () => {
  it('opens one row per stored entry, pointing at it', () => {
    expect(blockListRowsOf([{ id: 'e1', value: 'a.com' }])).toEqual([{ value: 'a.com', entryId: 'e1' }]);
  });
});
