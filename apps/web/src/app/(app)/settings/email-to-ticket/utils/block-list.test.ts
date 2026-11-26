import { describe, expect, it } from 'vitest';
import {
  blockListChanges,
  blockListRowOfField,
  blockListRowsSchema,
  blockListValueError,
  blockListValues,
  normalizeBlockListValue,
} from './block-list';

describe('normalizeBlockListValue', () => {
  it('trims whitespace, NBSP, zero-width space and BOM, and lower-cases', () => {
    expect(normalizeBlockListValue(' ​ Spam@Example.COM ﻿')).toBe('spam@example.com');
  });
});

describe('blockListValueError', () => {
  it.each(['n0rthwind.co', 'noreply@quillfeather.tv', 'mail.xn--80ak6aa92e.com', ''])('accepts %j', value => {
    expect(blockListValueError(value)).toBeNull();
  });

  it.each([
    ['localhost', 'domain'],
    ['example.com.', 'domain'],
    ['a@b@example.com', 'address'],
    ['@example.com', 'address'],
    ['*@example.com', 'Wildcards'],
    ['spam?.com', 'Wildcards'],
    ['10.0.0.1', 'IP'],
    ['user@10.0.0.1', 'IP'],
    ['пример.рф', 'punycode'],
    [`${'a'.repeat(250)}@example.com`, '254'],
  ])('refuses %j', (value, said) => {
    expect(blockListValueError(value)).toContain(said);
  });
});

describe('blockListRowsSchema', () => {
  it('marks a repeat on its second row, however it is written', () => {
    const result = blockListRowsSchema.safeParse([{ value: 'spam.com' }, { value: '' }, { value: ' SPAM.com ' }]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map(issue => issue.path)).toEqual([[2, 'value']]);
  });

  it('lets blank rows through', () => {
    expect(blockListRowsSchema.safeParse([{ value: '' }, { value: '  ' }]).success).toBe(true);
  });
});

describe('blockListValues', () => {
  it('sends the normalized values without the blanks', () => {
    expect(blockListValues([{ value: ' A.com' }, { value: '' }, { value: 'x@B.com' }])).toEqual(['a.com', 'x@b.com']);
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

describe('blockListChanges', () => {
  const stored = [
    { id: 'e1', value: 'a.com' },
    { id: 'e2', value: 'b.com' },
    { id: 'e3', value: 'c.com' },
  ];

  it('keeps an unchanged row, removes a dropped one, swaps an edited one and adds a new one', () => {
    const changes = blockListChanges(stored, [
      { value: ' A.com ', entryId: 'e1' },
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
    const rows = stored.map(entry => ({ value: entry.value, entryId: entry.id }));
    expect(blockListChanges(stored, rows)).toEqual({ remove: [], add: [] });
  });
});
