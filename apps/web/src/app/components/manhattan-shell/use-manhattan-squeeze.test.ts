/**
 * The v2 shell's window form: only the tablet band is compact; a narrower desktop window
 * folds no sidebar.
 */

import { describe, expect, it } from 'vitest';
import { squeezeOf } from './use-manhattan-squeeze';

describe('squeezeOf', () => {
  it('is compact from md up to two rails + 800px, and leaves the phone to its own shell', () => {
    expect(squeezeOf({ windowWidth: 860 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 800 }).compact).toBe(true);
    expect(squeezeOf({ windowWidth: 912 }).compact).toBe(false);
    expect(squeezeOf({ windowWidth: 700 }).compact).toBe(false);
  });

  it('folds nothing on a narrow desktop: the sidebars stay as the user left them', () => {
    for (const windowWidth of [1000, 1100, 1280, 1440]) expect(squeezeOf({ windowWidth })).toEqual({ compact: false });
  });
});
