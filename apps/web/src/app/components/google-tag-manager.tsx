'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { isDesktopShell } from '@/lib/platform';
import { runtimeEnv } from '@/lib/runtime-config';

interface GoogleTagManagerProps {
  containerId?: string;
  /**
   * Off in the static export: it prerenders without the id (the shell injects it at runtime), so a
   * `<noscript>` would exist only on the client and fail hydration (React #418) on every boot.
   */
  noscriptFallback: boolean;
}

/**
 * Never in the desktop app (CU-17tkuw6abhg). The container loads GA4, PostHog with session recording,
 * surveys and dead-click capture, and a pixel tag on every page view, all of it held in the app's one
 * long-lived page. The shell injects no id either.
 */
export function GoogleTagManager({ containerId, noscriptFallback }: GoogleTagManagerProps) {
  const id = isDesktopShell() ? undefined : containerId || runtimeEnv.gtmContainerId();

  useEffect(() => {
    if (!id) return;
    // GTM's queue: the snippet below pushes onto it, and this makes sure it
    // exists before the tag script loads.
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
  }, [id]);

  if (!id) return null;

  return (
    <>
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${id}');
          `.trim(),
        }}
      />

      {noscriptFallback && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${id}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}
    </>
  );
}
