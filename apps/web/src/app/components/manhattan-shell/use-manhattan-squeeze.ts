'use client';

import { useSyncExternalStore } from 'react';

/** The narrowest the centre (the chat and the page, side by side or one) gets beside two rails. */
export const MANHATTAN_CENTRE_MIN_WIDTH = 800;
/** A sidebar's rail. */
const RAIL_WIDTH = 56;
/** The layout's tablet step (`md`): below it the phone shell. */
const TABLET_MIN_WIDTH = 800;
/** Two rails and the centre's 800px (plan D19): narrower, the v2 top bar and the sidebars as drawers. */
export const MANHATTAN_COMPACT_BELOW = 2 * RAIL_WIDTH + MANHATTAN_CENTRE_MIN_WIDTH;

/**
 * The window's form for the v2 shell. `compact`: from md to {@link MANHATTAN_COMPACT_BELOW}
 * not even the rails fit — the v2 top bar opens the sidebars as drawers and the centre shows
 * one column. Wider, the sidebars stay as the user left them: a narrower window does not
 * fold them (the work area's columns squeeze and scroll sideways instead).
 */
export interface ManhattanSqueeze {
  compact: boolean;
  /**
   * The window has been read. `false` on the server and through hydration, where `compact` is
   * only a guess (`false`): there the stylesheet draws the compact band by itself
   * ({@link COMPACT_BAND_HIDDEN}, {@link COMPACT_BAND_FLEX}), so the first paint between md and
   * {@link MANHATTAN_COMPACT_BELOW} is the compact layout and not the rails squeezing the page.
   */
  measured: boolean;
}

const NOT_COMPACT: ManhattanSqueeze = { compact: false, measured: true };
const COMPACT: ManhattanSqueeze = { compact: true, measured: true };
const UNMEASURED: ManhattanSqueeze = { compact: false, measured: false };

/**
 * The compact band (md up to {@link MANHATTAN_COMPACT_BELOW}) in the stylesheet, for what the
 * shell draws before the window is read (`ManhattanSqueeze.measured`): the sidebars' rails hide
 * (they become closed drawers once it is read) and the compact top bar shows. Tailwind reads the
 * classes from the source, so the step is written out; a test ties it to the constant.
 * `max-[911px]` is `(max-width: 911px)`, inclusive: 912px is already the two-column window.
 */
export const COMPACT_BAND_HIDDEN = 'md:max-[911px]:hidden';
/** {@link COMPACT_BAND_HIDDEN}'s counterpart: shown (flex) in the compact band only. */
export const COMPACT_BAND_FLEX = 'md:max-[911px]:flex';

/** {@link ManhattanSqueeze} for a window this wide. */
export function squeezeOf({ windowWidth }: { windowWidth: number }): ManhattanSqueeze {
  return windowWidth >= TABLET_MIN_WIDTH && windowWidth < MANHATTAN_COMPACT_BELOW ? COMPACT : NOT_COMPACT;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

// The form, not the width: a resize re-renders only when it crosses a step (the forms are
// shared constants, so the snapshot stays the same object between steps).
const snapshot = () => squeezeOf({ windowWidth: window.innerWidth });
/** Not read on the server and through hydration: the compact band is the stylesheet's there. */
const serverSnapshot = () => UNMEASURED;

/** {@link squeezeOf} for this window, live. `enabled` off (an OSS tenant): never compact. */
export function useManhattanSqueeze(enabled: boolean): ManhattanSqueeze {
  const squeeze = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return enabled ? squeeze : NOT_COMPACT;
}
