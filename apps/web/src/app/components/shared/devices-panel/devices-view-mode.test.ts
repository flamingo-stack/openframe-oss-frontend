/**
 * The devices list's shape: the grid where its switch is drawn (a page at least the content-md step wide, a 768px
 * tablet's included), the table on a narrower page whatever `?viewMode` keeps, so the grid comes back when the
 * page widens again.
 */

import { describe, expect, it } from 'vitest';
import { devicesViewMode } from './devices-view-mode';

describe('devicesViewMode', () => {
  it('is the grid the URL asks for on a page wide enough for the switch, a 768px tablet included', () => {
    expect(devicesViewMode('grid', true)).toBe('grid');
  });

  it('is the table on a page too narrow for the switch, the grid left in the URL', () => {
    expect(devicesViewMode('grid', false)).toBe('table');
  });

  it('keeps the grid while the width is not known yet, so nothing is decided on a guess', () => {
    expect(devicesViewMode('grid', undefined)).toBe('grid');
  });

  it('is the table by default, for anything but the grid', () => {
    for (const param of [null, '', 'table', 'cards']) {
      expect(devicesViewMode(param, true)).toBe('table');
    }
  });
});
