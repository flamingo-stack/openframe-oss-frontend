/**
 * The board's status filter: `?status=`, the status ids the table filters by too. On the
 * board a lane IS a status, so the filter picks the lanes it shows.
 *
 * Ids that name no lane (a status deleted since the link was made, a hand-edited URL) are
 * dropped; with none left the filter is off and every lane shows — an empty board would
 * read as "no tickets", not as "this filter matches nothing". `activeIds` is the filter as
 * applied (lane order), the value the board's status control shows.
 */
export function resolveBoardStatusFilter<Lane extends { id: string }>(
  lanes: Lane[],
  statusIds: readonly string[] | undefined,
): { activeIds: string[]; lanes: Lane[] } {
  if (!statusIds || statusIds.length === 0) return { activeIds: [], lanes };
  const wanted = new Set(statusIds);
  const shown = lanes.filter(lane => wanted.has(lane.id));
  if (shown.length === 0) return { activeIds: [], lanes };
  return { activeIds: shown.map(lane => lane.id), lanes: shown };
}
