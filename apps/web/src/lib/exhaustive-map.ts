/**
 * Lookup for maps that are *typed* as exhaustive over an enum but are read with
 * a plain string.
 *
 * The pattern this serves: presentation tables declared as
 * `{ … } satisfies Record<SomeSchemaEnum, T>` instead of a `switch` with a
 * `default:` branch. The annotation is the point — when `npm run fetch-schema`
 * + `npm run generate-enums` widen the enum, the table stops type-checking
 * until the new value is given an answer, rather than silently falling into the
 * default and rendering a raw `SOME_NEW_VALUE`.
 *
 * The key still has to be a `string` at the call site: enum values reach the UI
 * through Relay artifacts, which type them as the union *plus*
 * `"%future added value"` for a backend running ahead of our checked-in SDL. So
 * "key not in the map" stays a runtime possibility — but it now means the
 * server is ahead of us, not that a branch was forgotten. Callers decide what
 * that renders as (usually the raw value, or a neutral tag).
 *
 * Own keys only: the key comes off the wire or the URL, and `in` would answer
 * `toString` or `__proto__` with what the map inherits from `Object.prototype`.
 */
export function presentationFor<K extends string, V>(map: Record<K, V>, key: string | null | undefined): V | undefined {
  return key != null && Object.hasOwn(map, key) ? map[key as K] : undefined;
}

/**
 * The same question when the caller needs the enum value itself rather than a
 * row of a table: a Relay-typed string narrowed to a `@/generated/schema-enums`
 * const, or null for a value this build does not know.
 */
export function knownValue<T extends string>(values: Record<string, T>, value: string | null | undefined): T | null {
  return value != null && (Object.values(values) as string[]).includes(value) ? (value as T) : null;
}

/**
 * {@link knownValue} over a list, e.g. a funnel's ticks from the URL: the values this build knows, in their order, the
 * rest dropped, so a hand-edited or stale URL cannot send the server an unknown enum.
 */
export function knownValues<T extends string>(values: Record<string, T>, selected: readonly string[]): T[] {
  return selected.map(value => knownValue(values, value)).filter((value): value is T => value !== null);
}
