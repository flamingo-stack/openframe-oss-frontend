import { describe, expect, it } from 'vitest';
import { blockListChanges } from './block-list-changes';

const STORED = [
  { id: 'e1', value: 'a.com' },
  { id: 'e2', value: 'b.com' },
  { id: 'e3', value: 'c.com' },
];

describe('blockListChanges', () => {
  it('keeps an unchanged row, removes a dropped one, swaps an edited one and adds a new one', () => {
    const changes = blockListChanges(STORED, [
      { value: ' a.com ', entryId: 'e1' },
      { value: 'z.com', entryId: 'e3' },
      { value: '' },
      { value: 'new@x.com' },
    ]);
    expect(changes.remove.map(entry => entry.id)).toEqual(['e2', 'e3']);
    expect(changes.add).toEqual([
      { index: 1, value: 'z.com' },
      { index: 3, value: 'new@x.com' },
    ]);
  });

  it('changes nothing when the rows are the stored list', () => {
    const rows = STORED.map(entry => ({ value: entry.value, entryId: entry.id }));
    expect(blockListChanges(STORED, rows)).toEqual({ remove: [], add: [] });
  });
});
