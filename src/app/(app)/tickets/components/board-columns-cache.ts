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

export interface CachedBoardColumn {
  id: string;
  /** Canonical status key for header styling; absent for custom statuses. */
  statusKey?: string;
  label: string;
  color: string;
  system: boolean;
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
    return parsed.every(c => c && typeof c.id === 'string' && typeof c.label === 'string') ? parsed : null;
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
const SYSTEM_FALLBACK_COLUMNS: BoardColumnDef[] = [
  columnFromTicketStatus('AI_ASSISTANCE', NO_TICKETS, { isLoading: true, system: true }),
  columnFromTicketStatus('TECH_REQUIRED', NO_TICKETS, { isLoading: true, system: true }),
  columnFromTicketStatus('RESOLVED', NO_TICKETS, { isLoading: true, system: true }),
];

/**
 * The lanes to render while the real ones are unknown — used by BOTH the route
 * skeleton and `TicketsBoard` itself while its statuses query is in flight.
 *
 * Sharing one builder is the point: the board used to map an empty status list
 * to zero columns, so the loaded page opened on a blank strip before the lanes
 * appeared. Standing in with the same placeholders on both sides makes the
 * skeleton → page handoff a no-op.
 */
export function buildPlaceholderBoardColumns(): BoardColumnDef[] {
  const cached = readCachedBoardColumns();
  if (!cached) return SYSTEM_FALLBACK_COLUMNS;
  return cached.map(column => ({ ...column, tickets: NO_TICKETS, isLoading: true }));
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
