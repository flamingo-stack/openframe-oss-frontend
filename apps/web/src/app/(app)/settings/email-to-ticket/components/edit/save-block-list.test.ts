import { describe, expect, it, vi } from 'vitest';
import { saveBlockList } from './save-block-list';

const STORED = [
  { id: 'e1', value: 'a.com' },
  { id: 'e2', value: 'b.com' },
];

describe('saveBlockList', () => {
  it('removes before it adds, and points each added row at its new entry', async () => {
    const calls: string[] = [];
    const remove = vi.fn(async (id: string) => {
      calls.push(`remove ${id}`);
      return {};
    });
    const add = vi.fn(async (value: string) => {
      calls.push(`add ${value}`);
      return { entry: { id: `new-${value}`, value } };
    });
    const result = await saveBlockList(
      STORED,
      [
        { value: 'a.com', entryId: 'e1' },
        { value: 'b2.com', entryId: 'e2' },
      ],
      { add, remove },
    );
    expect(calls).toEqual(['remove e2', 'add b2.com']);
    expect(result).toEqual({
      stored: [
        { id: 'e1', value: 'a.com' },
        { id: 'new-b2.com', value: 'b2.com' },
      ],
      rows: [
        { value: 'a.com', entryId: 'e1' },
        { value: 'b2.com', entryId: 'new-b2.com' },
      ],
      rowErrors: [],
      error: null,
    });
  });

  it('marks a refused addition on its row and goes on with the rest', async () => {
    const add = vi.fn(async (value: string) =>
      value === 'bad' ? { error: 'Refused' } : { entry: { id: `new-${value}`, value } },
    );
    const result = await saveBlockList([], [{ value: 'bad' }, { value: 'ok.com' }], { add, remove: vi.fn() });
    expect(result.rowErrors).toEqual([{ index: 0, message: 'Refused' }]);
    expect(result.rows).toEqual([{ value: 'bad' }, { value: 'ok.com', entryId: 'new-ok.com' }]);
    expect(result.stored).toEqual([{ id: 'new-ok.com', value: 'ok.com' }]);
  });

  it('stops before adding anything when a removal fails, keeping what was removed', async () => {
    const remove = vi.fn(async (id: string) => (id === 'e2' ? { error: 'Gone wrong' } : {}));
    const add = vi.fn();
    const result = await saveBlockList(STORED, [{ value: 'new.com' }], { add, remove });
    expect(add).not.toHaveBeenCalled();
    expect(result.error).toBe('Gone wrong');
    expect(result.stored).toEqual([{ id: 'e2', value: 'b.com' }]);
  });
});
