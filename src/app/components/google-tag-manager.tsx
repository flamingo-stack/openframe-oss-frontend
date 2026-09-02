'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { runtimeEnv } from '@/lib/runtime-config';

interface GoogleTagManagerProps {
  containerId?: string;
}

export function GoogleTagManager({ containerId }: GoogleTagManagerProps) {
  const id = containerId || runtimeEnv.gtmContainerId();

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

      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${id}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}
