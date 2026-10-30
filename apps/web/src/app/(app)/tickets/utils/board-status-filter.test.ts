import { describe, expect, it } from 'vitest';
import { resolveBoardStatusFilter } from './board-status-filter';

const LANES = [{ id: 'ai' }, { id: 'tech' }, { id: 'custom-1' }, { id: 'resolved' }];

describe('resolveBoardStatusFilter', () => {
  it('shows every lane with no filter', () => {
    expect(resolveBoardStatusFilter(LANES, undefined)).toEqual({ activeIds: [], lanes: LANES });
    expect(resolveBoardStatusFilter(LANES, [])).toEqual({ activeIds: [], lanes: LANES });
  });

  it('shows only the lanes the filter names, in lane order', () => {
    expect(resolveBoardStatusFilter(LANES, ['resolved', 'ai'])).toEqual({
      activeIds: ['ai', 'resolved'],
      lanes: [{ id: 'ai' }, { id: 'resolved' }],
    });
  });

  it('drops ids that name no lane', () => {
    expect(resolveBoardStatusFilter(LANES, ['gone', 'tech'])).toEqual({
      activeIds: ['tech'],
      lanes: [{ id: 'tech' }],
    });
  });

  it('is off when no id names a lane, rather than an empty board', () => {
    expect(resolveBoardStatusFilter(LANES, ['gone'])).toEqual({ activeIds: [], lanes: LANES });
  });
});
