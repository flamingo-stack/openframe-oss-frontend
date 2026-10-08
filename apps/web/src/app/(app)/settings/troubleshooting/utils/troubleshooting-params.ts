/** `deviceLogs(machineIds:)` reads at most this many devices in one query. */
export const TROUBLESHOOTING_DEVICE_LIMIT = 50;

/**
 * The `device` URL params as the query takes them: trimmed, unique, capped at
 * the API's limit. `undefined` when none is picked — the whole tenant — because
 * an empty list is a request the API rejects, not a wider one.
 */
export function machineIdsFromParams(values: readonly string[]): string[] | undefined {
  const ids = [...new Set(values.map(value => value.trim()).filter(value => value !== ''))];
  return ids.length > 0 ? ids.slice(0, TROUBLESHOOTING_DEVICE_LIMIT) : undefined;
}
