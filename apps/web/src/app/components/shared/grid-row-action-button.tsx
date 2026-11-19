'use client';

import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { MouseEvent, ReactNode } from 'react';

interface GridRowActionButtonProps {
  /** Accessible name: what the action does, and to what. */
  label: string;
  /** The action's glyph. */
  icon: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** The row does not allow the action: drawn for real and inert, like a loading row. */
  disabled?: boolean;
}

/**
 * One row action in a GRID table's action column (`actionColumn()`): the 40px button with no border or fill of its own
 * (the column is the box), the form `OpenRowButton` takes with `grid`. `data-no-row-click` keeps the row's own link
 * from firing underneath it. Static chrome: while the row is read (a loading scope) it is drawn for real and inert.
 */
export function GridRowActionButton({ label, icon, onClick, disabled = false }: GridRowActionButtonProps) {
  const inert = useLoadingScope() || disabled;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={inert ? undefined : onClick}
        disabled={inert}
        variant="transparent"
        size="icon"
        leftIcon={icon}
        aria-label={label}
        className="size-10 border-0 md:size-10"
      />
    </div>
  );
}
