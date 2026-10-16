import type React from 'react';

const LABEL = 'Added by';

/** The "Added by" cell frame: an optional avatar beside the [value, label] column. */
export function AddedByFrame({ avatar, children }: { avatar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {children}
        <p className="truncate text-ods-text-secondary text-h6">{LABEL}</p>
      </div>
    </div>
  );
}
