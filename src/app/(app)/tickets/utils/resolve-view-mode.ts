export type TicketsViewMode = 'table' | 'board';

/**
 * How `/tickets` picks between the board and the table.
 *
 * `?viewMode=` wins whenever it is set — the view selector writes it, so a phone
 * can still be put on the board and stay there. Without it the default follows
 * the viewport: the board's lanes are a horizontal scroll of one-and-a-bit
 * columns below md, where the table reads as a normal list.
 *
 * Shared with `TicketsPageSkeleton` so the two cannot answer differently. That
 * skeleton draws whichever mode is about to appear and is written to mirror this
 * view exactly, which is the whole reason the rule is a function rather than an
 * expression inlined in each — note it is not mounted by a route yet.
 */
export function resolveTicketsViewMode(rawViewMode: string | undefined, isMobileViewport: boolean): TicketsViewMode {
  if (!rawViewMode) return isMobileViewport ? 'table' : 'board';
  return rawViewMode === 'board' ? 'board' : 'table';
}
