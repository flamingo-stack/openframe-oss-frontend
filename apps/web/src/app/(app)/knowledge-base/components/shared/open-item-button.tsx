'use client';

import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { openInNewTab } from '@/lib/open-in-new-tab';

/**
 * The trailing ↗ of a knowledge base row. `data-no-row-click` keeps the row's
 * own link from firing underneath it.
 */
export function OpenItemButton({ href }: { href: string }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={openInNewTab(href)}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
      />
    </div>
  );
}
