'use client';

import { Button, ContentPageContainer } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';

/**
 * Route-segment error boundary: catches render/data errors thrown below the
 * root layout so the app shell (header, sidebar, safe-area chrome) stays
 * mounted and only the page content is replaced. `reset()` re-renders the
 * failed segment; a full reload is the fallback when the error is not
 * recoverable.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Error Boundary]', error);
  }, [error]);

  return (
    <ContentPageContainer
      title="Something Went Wrong"
      subtitle="An unexpected error occurred while loading this page."
    >
      <div className="flex gap-4">
        <Button variant="accent" onClick={reset}>
          Try Again
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </ContentPageContainer>
  );
}
