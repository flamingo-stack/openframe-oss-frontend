/**
 * A date column's header in the two table layouts. Card rows draw the app's own control as the header node; the grid
 * draws its date header itself from the column's `meta.dateFilter` and names the column by its string header.
 */

import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateColumnHeader, dateColumnHeader, type TableDateFilter } from './date-column-header';

const FILTER: TableDateFilter = { sortDirection: 'desc', range: undefined, onApply: vi.fn() };

describe('dateColumnHeader', () => {
  it('hands the grid the column’s name and the filter for its own date header', () => {
    expect(dateColumnHeader('Execution', FILTER, 'grid')).toEqual({ header: 'Execution', dateFilter: FILTER });
  });

  it('keeps the app’s control as the header of card rows, and gives them no grid filter', () => {
    const { header, dateFilter } = dateColumnHeader('Execution', FILTER, 'cards');
    expect(dateFilter).toBeUndefined();
    const node = typeof header === 'function' ? header() : null;
    expect(isValidElement(node) && node.type).toBe(DateColumnHeader);
    expect(node?.props).toEqual({ label: 'Execution', filter: FILTER });
  });

  it('draws card rows where no layout is named (a loading table’s columns)', () => {
    expect(typeof dateColumnHeader('Execution', undefined).header).toBe('function');
  });

  it('names the grid column with no date menu while there is no filter yet', () => {
    expect(dateColumnHeader('Execution', undefined, 'grid')).toEqual({ header: 'Execution', dateFilter: undefined });
  });
});
