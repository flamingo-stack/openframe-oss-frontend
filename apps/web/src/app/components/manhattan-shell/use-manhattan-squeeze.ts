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
}

const NOT_COMPACT: ManhattanSqueeze = { compact: false };
const COMPACT: ManhattanSqueeze = { compact: true };

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
/** Not compact on the server and through hydration: the sidebars' own first paint stands. */
const serverSnapshot = () => NOT_COMPACT;

/** {@link squeezeOf} for this window, live. `enabled` off (an OSS tenant): never compact. */
export function useManhattanSqueeze(enabled: boolean): ManhattanSqueeze {
  const squeeze = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return enabled ? squeeze : NOT_COMPACT;
}
