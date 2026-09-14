import type { ReactNode } from 'react';

/**
 * Renders a segment unchanged. Exists purely so a route can carry a title:
 * `metadata` may only be exported from a server component, so a segment whose
 * page is a client component — which is every page under (app) — needs a server
 * `layout.tsx` to hang one on.
 *
 * Each such layout is a title and a re-export of this component
 *
 *   export { default } from '@/app/(app)/route-title-layout';
 *   export const metadata: Metadata = { title: routeTitle('Devices') };
 *
 * and every route below it inherits that title until another layout sets one.
 *
 * Titles have to arrive this way, through the metadata system, rather than as a
 * `document.title` write from a client component. Next re-renders the resolved
 * metadata into <head> on every navigation, a commit or two AFTER the route's
 * own effects run, so a client-side assignment is overwritten within ~20ms of
 * being made — and a `<title>` element rendered from a client component only
 * adds a second one that the first still wins over.
 *
 * The title is also what the desktop shell mirrors onto its native window title
 * (openframe-desktop, `set_window_title`), which is why a route left without one
 * is not merely untidy: its window is labelled with the root layout's marketing
 * sentence.
 */
export default function RouteTitleLayout({ children }: { children: ReactNode }) {
  return children;
}
