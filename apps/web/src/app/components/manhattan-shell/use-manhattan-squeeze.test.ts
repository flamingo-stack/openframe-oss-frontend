/**
 * Plan D19: on a desktop the centre keeps 800px — the right navigation goes to its rail
 * first, then the chats; below the desktop step the layout's tablet rails do it.
 */

import { describe, expect, it } from 'vitest';
import { squeezeOf } from './use-manhattan-squeeze';

const expanded = { leftCollapsed: false, rightCollapsed: false };

describe('squeezeOf', () => {
  it('leaves both sidebars while the centre has 800px', () => {
    // 1440 − 280 − 200 = 960.
    expect(squeezeOf({ windowWidth: 1440, leftWidth: 280, ...expanded })).toEqual({
      left: false,
      right: false,
      compact: false,
    });
    // 1280 − 280 − 200 = 800 exactly.
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 280, ...expanded })).toEqual({
      left: false,
      right: false,
      compact: false,
    });
  });

  it('takes the right navigation first', () => {
    // 1280 − 300 − 200 = 780 < 800; with the right rail 1280 − 300 − 56 = 924.
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 300, ...expanded })).toEqual({
      left: false,
      right: true,
      compact: false,
    });
  });

  it('then the chats', () => {
    // 1280 − 480 − 56 = 744 < 800.
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 480, ...expanded })).toEqual({
      left: true,
      right: true,
      compact: false,
    });
  });

  it('counts a collapsed sidebar as its rail and never squeezes it', () => {
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 480, leftCollapsed: false, rightCollapsed: true })).toEqual({
      left: true,
      right: false,
      compact: false,
    });
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 300, leftCollapsed: false, rightCollapsed: true })).toEqual({
      left: false,
      right: false,
      compact: false,
    });
    expect(squeezeOf({ windowWidth: 1280, leftWidth: 480, leftCollapsed: true, rightCollapsed: false })).toEqual({
      left: false,
      right: false,
      compact: false,
    });
  });

  it('leaves the tablet widths to the layout', () => {
    expect(squeezeOf({ windowWidth: 1100, leftWidth: 480, ...expanded })).toEqual({
      left: false,
      right: false,
      compact: false,
    });
  });

  it('is compact from md up to two rails + 800px, and leaves the phone to its own shell', () => {
    expect(squeezeOf({ windowWidth: 860, leftWidth: 280, ...expanded }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 800, leftWidth: 280, ...expanded }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 912, leftWidth: 280, ...expanded }).compact).toBe(false);
    expect(squeezeOf({ windowWidth: 700, leftWidth: 280, ...expanded }).compact).toBe(false);
  });
});
