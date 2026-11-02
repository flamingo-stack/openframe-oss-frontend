'use client';

import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { createRoot } from 'react-dom/client';

function StripeTabPlaceholder({ caption }: { caption: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="flex w-full max-w-md flex-col gap-[var(--spacing-system-mf)]">
        <p role="status" className="text-ods-text-secondary text-h4">
          {caption}
        </p>
        <div className="flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]">
          <TextLineSkeleton type="h6" className="w-1/3" />
          <TextLineSkeleton type="h2" className="w-1/2" />
          <TextLineSkeleton type="h6" lines={2} />
          <UnifiedSkeleton className="h-11" />
        </div>
      </div>
    </main>
  );
}

/**
 * Draws the waiting state into a tab this page just opened, which would otherwise stay a white `about:blank` until
 * Stripe's page paints. The tab has no app of its own, so it borrows this page's stylesheets and the attributes the
 * design tokens hang off.
 */
export function paintStripeTabPlaceholder(target: Window, caption: string): void {
  const tab = target.document;

  tab.title = `${caption} | OpenFrame`;
  tab.documentElement.lang = document.documentElement.lang;
  tab.documentElement.className = document.documentElement.className;
  tab.body.className = document.body.className;
  Object.assign(tab.body.dataset, document.body.dataset);
  tab.head.append(
    ...Array.from(document.querySelectorAll('style, link[rel="stylesheet"], link[rel~="icon"]'), node =>
      tab.importNode(node, true),
    ),
  );

  createRoot(tab.body.appendChild(tab.createElement('div'))).render(<StripeTabPlaceholder caption={caption} />);
}
