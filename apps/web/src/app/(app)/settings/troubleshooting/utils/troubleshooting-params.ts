/** `deviceLogs` reads at most this many devices, and this many customers, in one query. */
export const TROUBLESHOOTING_PICK_LIMIT = 50;

/**
 * A picker's URL params (`device`, `customer`) as the query takes them: trimmed,
 * unique, capped at the API's limit. `undefined` when nothing is picked — the
 * whole tenant — because an empty list is a request the API rejects, not a
 * wider one.
 */
export function pickedIdsFromParams(values: readonly string[]): string[] | undefined {
  const ids = [...new Set(values.map(value => value.trim()).filter(value => value !== ''))];
  return ids.length > 0 ? ids.slice(0, TROUBLESHOOTING_PICK_LIMIT) : undefined;
}
