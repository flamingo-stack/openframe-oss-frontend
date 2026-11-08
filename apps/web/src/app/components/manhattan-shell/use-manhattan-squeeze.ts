'use client';

import { useSyncExternalStore } from 'react';
import { readChosenSidebarWidth } from '@/lib/navigation-sidebar-state';
import { MANHATTAN_CHATS_EXPANDED_WIDTH, MANHATTAN_NAVIGATION_EXPANDED_WIDTH } from './use-manhattan-shell';

/** The narrowest the centre (the chat and the page, side by side or one) gets on a desktop (plan D19). */
export const MANHATTAN_CENTRE_MIN_WIDTH = 800;
/** A sidebar's rail. */
const RAIL_WIDTH = 56;
/** The layout's desktop step (`lg`): below it the sidebars are the tablet's rails anyway. */
const DESKTOP_MIN_WIDTH = 1280;
/** The layout's tablet step (`md`): below it the phone shell. */
const TABLET_MIN_WIDTH = 800;
/** Two rails and the centre's 800px (plan D19): narrower, the v2 top bar and the sidebars as drawers. */
export const MANHATTAN_COMPACT_BELOW = 2 * RAIL_WIDTH + MANHATTAN_CENTRE_MIN_WIDTH;

/**
 * Which sidebars give up their room to the centre: the rail, and opened over the centre
 * (`overlay`). `compact`: from md to {@link MANHATTAN_COMPACT_BELOW} not even the rails fit
 * — the v2 top bar opens the sidebars as drawers and the centre shows one column.
 */
export interface ManhattanSqueeze {
  left: boolean;
  right: boolean;
  compact: boolean;
}

const NO_SQUEEZE: ManhattanSqueeze = { left: false, right: false, compact: false };
const RIGHT_ONLY: ManhattanSqueeze = { left: false, right: true, compact: false };
const LEFT_ONLY: ManhattanSqueeze = { left: true, right: false, compact: false };
const BOTH: ManhattanSqueeze = { left: true, right: true, compact: false };
const COMPACT: ManhattanSqueeze = { left: false, right: false, compact: true };

interface SqueezeInput {
  windowWidth: number;
  /** The chats sidebar's expanded width (the user's choice). */
  leftWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  /** The navigation's expanded width. */
  rightWidth?: number;
}

/**
 * Plan D19: the centre is never narrower than {@link MANHATTAN_CENTRE_MIN_WIDTH} on a
 * desktop. When the expanded sidebars would leave it less, the right navigation goes to
 * its rail first, then the chats; a sidebar the user collapsed is a rail already. Below
 * the desktop step the layout's tablet rails do it.
 */
export function squeezeOf({
  windowWidth,
  leftWidth,
  leftCollapsed,
  rightCollapsed,
  rightWidth = MANHATTAN_NAVIGATION_EXPANDED_WIDTH,
}: SqueezeInput): ManhattanSqueeze {
  if (windowWidth >= TABLET_MIN_WIDTH && windowWidth < MANHATTAN_COMPACT_BELOW) return COMPACT;
  if (windowWidth < DESKTOP_MIN_WIDTH) return NO_SQUEEZE;
  const left = leftCollapsed ? RAIL_WIDTH : leftWidth;
  const right = rightCollapsed ? RAIL_WIDTH : rightWidth;
  if (windowWidth - left - right >= MANHATTAN_CENTRE_MIN_WIDTH) return NO_SQUEEZE;
  const leftToo = !leftCollapsed && windowWidth - left - RAIL_WIDTH < MANHATTAN_CENTRE_MIN_WIDTH;
  if (rightCollapsed) return leftToo ? LEFT_ONLY : NO_SQUEEZE;
  return leftToo ? BOTH : RIGHT_ONLY;
}

/** The window's width and the chats sidebar's chosen width, as one snapshot string. */
function snapshot(): string {
  return `${window.innerWidth}:${readChosenSidebarWidth(MANHATTAN_CHATS_EXPANDED_WIDTH)}`;
}

/**
 * Re-read on a window resize, and whenever the work area changes width (a sidebar
 * resized or toggled: the chosen width is committed by then).
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  const area = document.querySelector('[data-work-area]');
  const observer = area && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onChange) : null;
  if (area) observer?.observe(area);
  return () => {
    window.removeEventListener('resize', onChange);
    observer?.disconnect();
  };
}

/** Nothing squeezed on the server and through hydration: the sidebars' own first paint stands. */
const serverSnapshot = () => '0:0';

/** {@link squeezeOf} for this window, live. `enabled` off (the Mingo-first shell): nothing. */
export function useManhattanSqueeze(
  enabled: boolean,
  leftCollapsed: boolean,
  rightCollapsed: boolean,
): ManhattanSqueeze {
  const [windowWidth, leftWidth] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split(':').map(Number);
  if (!enabled || windowWidth === 0) return NO_SQUEEZE;
  return squeezeOf({ windowWidth, leftWidth, leftCollapsed, rightCollapsed });
}
