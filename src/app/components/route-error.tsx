'use client';

import { Button, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef } from 'react';

/**
 * The body every Next route-segment boundary renders. One implementation shared
 * by `app/error.tsx` and `(app)/error.tsx`, which differ only in WHERE they sit
 * (and therefore how much of the screen they replace), never in what they show.
 *
 * ## Why not core-lib's `PageError`
 *
 * The in-page boundaries do use it — `ContentErrorBoundary` renders `LoadError`,
 * the dashboard's customers section renders `LoadError` — and this would too,
 * except `ErrorState` behind them is closed: its actions are fixed at
 * Try Again / Go Home with no slot, and it renders a bordered card meant to sit
 * inside a page.
 *
 * A route boundary needs neither. It has replaced the page, so it wants
 * page-weight presentation; and its second action is Reload, not Go Home, for a
 * specific reason — `reset()` re-renders the segment against the SAME Relay
 * environment, and `QueryResource`'s entry is temporarily retained for five minutes
 * (`TEMPORARY_RETAIN_DURATION_MS`, in react-relay's `SuspenseResource`), so
 * Try Again can rethrow instantly on a query that just failed. A reload builds a
 * fresh environment and always clears it.
 *
 * So the app has three error tiers: inline strip (`SectionLoadError`), in-page
 * (`ContentErrorBoundary` over core-lib `PageError` / `LoadError`), and route
 * (this). `global-error.tsx` stays separate on purpose — it replaces the
 * document, so it must render its own `<html>`/`<body>` with no providers.
 *
 * The in-page tier is not yet down to one implementation:
 * `shared/device-selector/device-list-picker.tsx` and
 * `shared/work-time-table/` still wrap core-lib `ErrorBoundary` with their own
 * retry-nonce, so they predate `OfflineError` and show a dead Retry offline.
 * Converting them is tracked with the rest of the rollout.
 */
export function RouteRecovery({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Console prefix identifying which boundary caught it. */
  label: string;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error(`[${label}]`, error);
  }, [error, label]);

  // The heading lives inside PageLayout, so the primary action is the focus
  // destination: keyboard/AT users land on the recovery control instead of
  // whatever the replaced page content had focused.
  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <div role="alert">
      <PageLayout title="Something Went Wrong" subtitle="An unexpected error occurred while loading this page.">
        <div className="flex gap-4">
          <Button ref={retryRef} variant="accent" onClick={reset}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </PageLayout>
    </div>
  );
}
