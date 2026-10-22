'use client';

import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { MouseEvent } from 'react';

interface OpenRowButtonProps {
  /** Accessible name — what opens, and where. */
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * The trailing ↗ of a table row. `data-no-row-click` keeps the row's own link
 * from firing underneath it. It is static chrome: while the row is read (a loading scope) it is drawn for real and
 * inert, since there is nothing to open yet.
 */
export function OpenRowButton({ label, onClick }: OpenRowButtonProps) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : onClick}
        disabled={loading}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={loading ? 'Open in new tab' : label}
        className="bg-ods-card"
      />
    </div>
  );
}
