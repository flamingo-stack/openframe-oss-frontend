'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef } from 'react';
import { LockedScreen } from '@/app/components/shared/locked-screen';

/**
 * Route-segment error boundary: catches render/data errors thrown below the
 * root layout so the app shell (header, sidebar, safe-area chrome) stays
 * mounted and only the page content is replaced. `reset()` re-renders the
 * failed segment; a full reload is the fallback when the error is not
 * recoverable.
 *
 * Drawn with `LockedScreen` — the same centered card the workspace-inactive and
 * no-access screens use. It used to be a bare `ContentPageContainer`, which put
 * the heading and both buttons flush against the top-left corner of an otherwise
 * empty viewport; whatever `<main>` this lands in, the wrapper below gives the
 * card a height to centre within.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error('[Error Boundary]', error);
  }, [error]);

  // The heading is inside the card, so the primary action is the focus
  // destination: keyboard/AT users land on the recovery control instead of
  // whatever the replaced page content had focused.
  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <div role="alert" className="flex min-h-[70vh] w-full">
      <LockedScreen
        icon={<AlertTriangleIcon className="size-8" />}
        title="Something Went Wrong"
        description="An unexpected error occurred while loading this page."
        actions={
          <>
            <Button ref={retryRef} variant="accent" onClick={reset}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </>
        }
      />
    </div>
  );
}
