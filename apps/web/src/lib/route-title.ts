import type { Metadata } from 'next';

/** Product name every in-app title ends with, matching the root layout's template. */
const APP_NAME = 'OpenFrame';

/**
 * Title for one surface, as `"Devices | OpenFrame"`.
 *
 * Absolute rather than a bare string leaning on the root layout's
 * `'%s | OpenFrame'` template, because that template only reaches the segment
 * directly below the layout that declares it: with plain strings `/devices`
 * resolves to "Devices | OpenFrame" but `/devices/details` — a level further
 * down — resolves to "Device", suffix silently dropped. An absolute title reads
 * the same at every depth, and cannot pick up the suffix twice.
 *
 * See `app/(app)/route-title-layout.tsx` for how a client-rendered section carries
 * one of these.
 */
export function routeTitle(name: string): Metadata['title'] {
  return { absolute: `${name} | ${APP_NAME}` };
}
