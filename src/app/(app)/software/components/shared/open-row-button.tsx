'use client';

import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { MouseEvent } from 'react';

interface OpenRowButtonProps {
  /** Accessible name — what opens, and where. */
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * The trailing ↗ of a table row. `data-no-row-click` keeps the row's own link
 * from firing underneath it.
 */
export function OpenRowButton({ label, onClick }: OpenRowButtonProps) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={onClick}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={label}
        className="bg-ods-card"
      />
    </div>
  );
}
