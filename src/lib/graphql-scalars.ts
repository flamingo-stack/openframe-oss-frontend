/**
 * The custom scalars of `schema.graphql` as TypeScript types, wired into every Relay artifact
 * through `customScalarTypes` in `relay.config.json`. Relay maps scalars at the type level only:
 * the store keeps the wire value, so this module is also the one place that knows each wire
 * format. Read a scalar through the parser here, build one through the constructor here.
 */

declare const brand: unique symbol;
type Branded<T, Name extends string> = T & { readonly [brand]: Name };

/**
 * `Instant`: an RFC 3339 UTC instant as Java's `Instant.toString()` prints it, with up to nine
 * fraction digits (`2026-09-23T09:04:26.847000044Z`).
 */
export type Instant = Branded<string, 'Instant'>;

/** `Date`: a calendar day, `yyyy-MM-dd`, with no time or zone (`LocalDate` on the server). */
export type LocalDate = Branded<string, 'LocalDate'>;

/** `Long` is a JSON number on the wire; a value past 2^53 loses precision in JavaScript. */
export type Long = number;

/** `JSON`: an opaque map or list, serialized as is. */
export type JsonValue = unknown;

// `Date` reads three fraction digits; Safari rejects a longer fraction outright, and V8 truncates it.
const FRACTION_PAST_MILLIS = /(\.\d{3})\d+(?=Z$)/;

/** The instant as a `Date` (millisecond precision), or null when it is not one. */
export function parseInstant(instant: string): Date | null {
  const date = new Date(instant.replace(FRACTION_PAST_MILLIS, '$1'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toInstant(date: Date): Instant {
  return date.toISOString() as Instant;
}

export function isInstant(value: string): value is Instant {
  return parseInstant(value) !== null;
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day as a `Date` at local midnight, or null when it is not one. `Date` alone reads `yyyy-MM-dd` as UTC midnight: the day before, west of UTC. */
export function parseLocalDate(day: string): Date | null {
  const match = LOCAL_DATE.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = new Date(year, month - 1, date);
  return parsed.getMonth() === month - 1 && parsed.getDate() === date ? parsed : null;
}

/** Adopts a string built elsewhere (a wall-clock instant, a stored value); throws on one `Date` cannot read. */
export function asInstant(value: string): Instant {
  if (!isInstant(value)) throw new Error(`Not an Instant: ${value}`);
  return value;
}
