'use client';

import { FlamingoLogo, OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import './globals.css';

/**
 * Root error boundary: the only boundary that catches errors thrown by the root
 * layout itself, so it fully replaces that layout and must render its own
 * `<html>`/`<body>`. None of the app providers or shell chrome are mounted here
 * — keep it self-contained (own styles import, plain reload action). Mirrors the
 * auth error page's full-screen layout so a root crash still looks on-brand.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased font-body" data-app-type="openframe">
        <div className="min-h-screen bg-ods-bg flex flex-col items-center justify-between p-10">
          <div className="flex items-center gap-2">
            <OpenFrameLogo
              className="h-10 w-auto"
              lowerPathColor="var(--color-accent-primary)"
              upperPathColor="var(--color-text-primary)"
            />
            <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
          </div>

          <div className="flex flex-col items-center gap-10 max-w-[600px] text-center">
            <div className="flex flex-col gap-2">
              <h1 className="text-h2 text-ods-text-primary">Something Went Wrong</h1>
              <p className="text-h4 text-ods-text-secondary">
                An unexpected error occurred. Please try again or reload the app.
              </p>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button variant="accent" onClick={reset}>
                Try Again
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 text-ods-text-secondary">
            <span className="text-h6">Powered by</span>
            <FlamingoLogo className="h-5 w-5" fill="currentColor" />
            <span className="text-code font-semibold">Flamingo</span>
          </div>
        </div>
      </body>
    </html>
  );
}
