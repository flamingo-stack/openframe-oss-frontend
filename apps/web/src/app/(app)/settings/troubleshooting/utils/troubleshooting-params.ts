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

/** The picker param whose id the API did not find in this tenant. */
export type UnknownPickParam = 'customer' | 'device';

/** The `deviceLogs` codes for a picked id outside the tenant: wrong, deleted, or from another tenant. */
const UNKNOWN_PICK_CODES: Record<string, UnknownPickParam> = {
  ORGANIZATION_NOT_FOUND: 'customer',
  DEVICE_NOT_FOUND: 'device',
};

/**
 * Which picker holds an id the API refused, from the `extensions.code` of the
 * query's GraphQL errors, with the API's message — it names the first unknown
 * id ("Organization not found: <id>"), devices checked before customers.
 * `null` for any other failure, which stays the generic load error.
 */
export function unknownPickFromErrors(
  errors: readonly { message: string; code: string | null }[],
): { param: UnknownPickParam; message: string } | null {
  for (const { message, code } of errors) {
    const param = code ? UNKNOWN_PICK_CODES[code] : undefined;
    if (param) return { param, message };
  }
  return null;
}

/**
 * The picks without the one the API named. Matched on the message's tail rather
 * than a parsed format, so a reworded message still finds its id, and the
 * longest match wins (`…: ab` also ends with `b`). When none of the picks is
 * named, every one of them goes: a filter that keeps the refused id would only
 * fail again.
 */
export function picksWithoutUnknown(values: readonly string[], message: string): string[] {
  const text = message.trim();
  const named = values
    .map(value => value.trim())
    .filter(id => id !== '' && text.endsWith(id))
    .reduce<string | null>((longest, id) => (longest === null || id.length > longest.length ? id : longest), null);
  if (named === null) return [];
  return values.filter(value => value.trim() !== named);
}
