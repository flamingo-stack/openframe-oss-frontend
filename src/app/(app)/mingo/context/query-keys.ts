/**
 * Canonical TanStack Query key factories for the Mingo context items.
 *
 * Centralizing these avoids ad-hoc inline query key arrays drifting apart
 * across files (e.g. rest-items.tsx and use-mingo-dialog.ts) and failing to
 * invalidate the correct cache entries.
 */

export const mingoContextKeys = {
  tickets: (query: string) => ['mingo-context', 'tickets', query] as const,
  policies: (query: string) => ['mingo-context', 'policies', query] as const,
  queries: (query: string) => ['mingo-context', 'queries', query] as const,
};
