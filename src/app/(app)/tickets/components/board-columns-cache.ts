'use client';

/**
 * Last-seen board column set, cached so the loading skeleton can lay out the
 * SAME lanes the board is about to show.
 *
 * The columns are tenant data (system statuses plus any custom ones, in the
 * tenant's own order), so before `useTicketStatusesQuery` resolves there is no
 * way to know how many lanes the board will have — and a skeleton with the
 * wrong lane count changes the board's width and scroll extent on the handoff.
 * Replaying the previous set fixes that for every visit after the first; a cold
 * profile falls back to the three system statuses.
 *
 * Same idea as the sidebar-width seed in the root layout: persist a layout
 * decision so the pre-data render matches the post-data one.
 */

import { type BoardColumnDef, columnFromTicketStatus } from '@flamingo-stack/openframe-frontend-core';
import { useEffect, useState } from 'react';
import { SYSTEM_KIND_META } from '../statuses/types/ticket-statuses.types';

export interface CachedBoardColumn {
  id: string;
  /** Canonical status key for header styling; absent for custom statuses. */
  statusKey?: string;
  label: string;
  color: string;
  system: boolean;
  /** Header info-icon hint (system statuses only); absent for custom statuses. */
  tooltip?: string;
}

const STORAGE_KEY = 'openframe:tickets-board-columns-v1';

export function readCachedBoardColumns(): CachedBoardColumn[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Written by us, but a stale/hand-edited entry must not crash the skeleton.
    // `color` and `statusKey` are both load-bearing and both reach a core
    // `.replace()` that throws on a non-string: `color` goes to the board's
    // `tintOnDark()`, `statusKey` to `TicketStatusTag` -> `getTicketStatusConfig`.
    // Either one would take down the route skeleton AND `TicketsBoard`.
    const valid = parsed.every(
      c =>
        c &&
        typeof c.id === 'string' &&
        typeof c.label === 'string' &&
        typeof c.color === 'string' &&
        (c.statusKey === undefined || typeof c.statusKey === 'string') &&
        (c.tooltip === undefined || typeof c.tooltip === 'string'),
    );
    // Picked field by field, not spread: a stale blob's extra keys would ride
    // `...c` straight into `BoardColumnDef` (`total`, `hasMore`, `archivable`,
    // `allowedFromColumns` are all real props the board reads), which is the
    // crash this validator exists to prevent.
    return valid
      ? parsed.map(c => ({
          id: c.id,
          statusKey: c.statusKey,
          label: c.label,
          color: c.color,
          system: !!c.system,
          tooltip: c.tooltip,
        }))
      : null;
  } catch {
    return null;
  }
}

const NO_TICKETS: never[] = [];

/**
 * Cold-profile fallback: the three system statuses every tenant has (ARCHIVED
 * is filtered off the board). Custom statuses sit between them, so this is only
 * the shape until the cache has seen a real board once.
 */
function systemFallbackColumn(kind: 'AI_ASSISTANCE' | 'TECH_REQUIRED' | 'RESOLVED') {
  // Spread rather than an override: the header's info-icon `tooltip` lands in
  // `BoardColumnDef` with the core-lib release that renders it, and the spread
  // stays type-safe on either side of that bump.
  return {
    ...columnFromTicketStatus(kind, NO_TICKETS, { isLoading: true, system: true }),
    tooltip: SYSTEM_KIND_META[kind].tooltip,
  };
}

const SYSTEM_FALLBACK_COLUMNS: BoardColumnDef[] = [
  systemFallbackColumn('AI_ASSISTANCE'),
  systemFallbackColumn('TECH_REQUIRED'),
  systemFallbackColumn('RESOLVED'),
];

/**
 * The lanes to render while the real ones are unknown — used by `TicketsBoard`
 * while its statuses query is in flight.
 *
 * The board used to map an empty status list to zero columns, so the page
 * opened on a blank strip before the lanes appeared; standing in with the
 * last-seen lane set makes the loading → loaded handoff a no-op.
 */
export function buildPlaceholderBoardColumns(): BoardColumnDef[] {
  const cached = readCachedBoardColumns();
  if (!cached) return SYSTEM_FALLBACK_COLUMNS;
  return cached.map(column => ({ ...column, tickets: NO_TICKETS, isLoading: true }));
}

/**
 * Set once any instance has mounted, so a later mount reads the cache in its
 * INITIALIZER instead of a render later. Mirrors the same module-flag pattern in
 * `onboarding-top-bar-cache`'s placeholder.
 */
let hasHydrated = false;

/**
 * Hydration-safe `buildPlaceholderBoardColumns` — use this from a render, never
 * the builder directly.
 *
 * `TicketsBoard` renders on the server, where `localStorage` does not exist:
 * the builder returns the three system statuses there and the tenant's real
 * cached lanes in the browser. Reading it in
 * a `useState` initializer therefore made the server and the first client render
 * disagree on the lane SET — different column count, different colors, different
 * counts — which is a hydration mismatch, and not a cosmetic one: React discards
 * the server HTML for the whole board and re-renders it, the exact redraw this
 * cache exists to remove.
 *
 * So the first render deliberately uses the system fallback on BOTH sides, and the
 * cached set is applied right after mount. The trade is a one-frame refinement of a
 * PLACEHOLDER (system lanes → the tenant's lanes) instead of a discarded subtree,
 * and it only shows at all in the window before the statuses query answers.
 */
export function usePlaceholderBoardColumns(): BoardColumnDef[] {
  const [columns, setColumns] = useState<BoardColumnDef[]>(() =>
    hasHydrated ? buildPlaceholderBoardColumns() : SYSTEM_FALLBACK_COLUMNS,
  );

  useEffect(() => {
    hasHydrated = true;
    // Only the pre-hydration value is replaced. Guarding on identity (rather than
    // a `hasHydrated` early return) keeps a remount free: its initializer already
    // read the cache, so this is a same-reference no-op React bails out of.
    setColumns(prev => (prev === SYSTEM_FALLBACK_COLUMNS ? buildPlaceholderBoardColumns() : prev));
  }, []);

  return columns;
}

export function writeCachedBoardColumns(columns: CachedBoardColumn[]): void {
  if (typeof window === 'undefined' || columns.length === 0) return;
  try {
    const next = JSON.stringify(columns);
    if (window.localStorage.getItem(STORAGE_KEY) === next) return;
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode / quota — the skeleton just falls back to the system statuses.
  }
}
