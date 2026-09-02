'use client';

import { RouteRecovery } from '../components/route-error';

/**
 * Error boundary for the signed-in app, nested INSIDE `(app)/layout.tsx`.
 *
 * Next nests an `error.tsx` under its own segment's layout, so where the file
 * lives decides how much of the screen a thrown error takes with it. The root
 * `app/error.tsx` sits ABOVE `(app)/layout.tsx`, which is where `AppLayout` — the
 * header, nav and safe-area chrome — is mounted. So every data error under
 * `(app)` used to replace the whole shell with a bare "Something Went Wrong"
 * page, exactly what `app/error.tsx`'s own doc comment claimed it prevented. It
 * could not: it was one segment too high.
 *
 * Why the Relay routes in particular: `useLazyLoadQuery` THROWS on a failed
 * request rather than returning an error, and `lib/relay/environment.ts` only
 * retries transient failures for a bounded budget. A sustained outage therefore
 * reaches a boundary by design — and with none below the chrome, "sustained
 * outage" looked like "the app crashed". Scripts, Knowledge Base, Logs,
 * Notifications and Worktime all shared this. Pages now catch their own data
 * failures inline with `ContentErrorBoundary`, so reaching THIS boundary means
 * the throw came from outside a page's data region.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteRecovery error={error} reset={reset} label="App Error Boundary" />;
}
