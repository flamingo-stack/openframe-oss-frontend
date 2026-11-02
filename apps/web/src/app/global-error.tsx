'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useRef } from 'react';
import { OpenframeLockup } from '@/app/components/shared/openframe-lockup';
import './globals.css';
import { PoweredByFlamingo } from '@/app/components/shared/powered-by-flamingo';
import { hideSplashScreen } from '@/lib/native-shell';

/**
 * Root error boundary: the only boundary that catches errors thrown by the root
 * layout itself, so it fully replaces that layout and must render its own
 * `<html>`/`<body>`. None of the app providers or shell chrome are mounted here
 * — keep it self-contained (own styles import, plain reload action). Mirrors the
 * auth error page's full-screen layout so a root crash still looks on-brand.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  // A crash during shell boot can land here BEFORE the initializer's
  // token-hydration chain hides the native splash — hide it now so the user
  // sees this error screen instead of an eternal splash. No-op on web.
  useEffect(() => {
    void hideSplashScreen();
  }, []);

  // This boundary replaces the entire document — move focus to the heading so
  // assistive tech lands on the error context instead of a removed element.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-body antialiased" data-app-type="openframe">
        <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-10">
          <OpenframeLockup />

          <div className="flex max-w-[600px] flex-col items-center gap-10 text-center">
            <div role="alert" className="flex flex-col gap-2">
              <h1 ref={headingRef} tabIndex={-1} className="text-ods-text-primary text-h2 focus:outline-none">
                Something Went Wrong
              </h1>
              <p className="text-ods-text-secondary text-h4">
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

          <PoweredByFlamingo />
        </div>
      </body>
    </html>
  );
}
