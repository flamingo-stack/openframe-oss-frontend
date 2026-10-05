// Readers for the remote-access wire shapes: GraphQL payloads with the
// untyped `Instant` scalar, and the flat NATS events on the technician's
// notification subject. Shared by the approval and the session services.

export type RawWire = Record<string, unknown>;

/** A non-empty string field, else undefined. */
export function text(raw: RawWire, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * `Instant` is an untyped scalar for Relay: it arrives as an ISO-8601 string
 * (Spring's default), but a numeric epoch (seconds, possibly fractional, or
 * milliseconds) is accepted too, so a Jackson setting on one host cannot
 * silently break a countdown.
 */
export function timestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1e12 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  return undefined;
}

export function nullableTimestamp(value: unknown): string | null | undefined {
  return value === null ? null : timestamp(value);
}

export function oneOf<T extends string>(value: unknown, allowed: ReadonlySet<string>): T | undefined {
  return typeof value === 'string' && allowed.has(value) ? (value as T) : undefined;
}
