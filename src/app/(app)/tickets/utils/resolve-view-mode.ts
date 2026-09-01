export type TicketsViewMode = 'table' | 'board';

/**
 * How `/tickets` picks between the board and the table.
 *
 * `?viewMode=` wins whenever it is set — the view selector writes it (from the
 * header on md+, from the "…" menu on mobile), so an explicit choice sticks.
 * Without it the default is the BOARD at every width: the board is fully
 * usable on touch now (swipeable lane pager), and the design makes it the
 * primary view on mobile too, so the default no longer consults the viewport.
 *
 * Only `'table'` selects the table; any other value (including legacy junk
 * like `?viewMode=grid`) falls back to the canonical board.
 */
export function resolveTicketsViewMode(rawViewMode: string | undefined): TicketsViewMode {
  return rawViewMode === 'table' ? 'table' : 'board';
}
