'use client';

import { RouteRecovery } from './components/route-error';

/**
 * Root route-segment boundary: catches throws from the root layout's children.
 *
 * NOTE this sits ABOVE `(app)/layout.tsx`, so it does NOT preserve the signed-in
 * app chrome — reaching here replaces the whole screen. Page-level errors inside
 * the app are caught one segment down by `(app)/error.tsx`, which keeps the
 * header and nav mounted; this covers what that cannot, i.e. a throw from
 * `(app)/layout.tsx` itself and the auth/marketing segments.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteRecovery error={error} reset={reset} label="Error Boundary" />;
}
