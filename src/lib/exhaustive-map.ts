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
 */
export function presentationFor<K extends string, V>(map: Record<K, V>, key: string | null | undefined): V | undefined {
  return key != null && key in map ? map[key as K] : undefined;
}
