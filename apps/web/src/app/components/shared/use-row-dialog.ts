'use client';

import { useState } from 'react';

interface RowDialog<TRow, TKind> {
  row: TRow;
  kind: TKind;
  isOpen: boolean;
}

/**
 * Which row's dialog a table has open. The table owns it, not the row: a row is a
 * link, and a successful archive or delete removes the row before the dialog has
 * closed. Closing keeps the row, so the dialog animates out with its content.
 */
export function useRowDialog<TRow, TKind extends string>() {
  const [dialog, setDialog] = useState<RowDialog<TRow, TKind> | null>(null);

  const open = (row: TRow, kind: TKind) => setDialog({ row, kind, isOpen: true });
  const close = () => setDialog(current => (current ? { ...current, isOpen: false } : current));

  return { dialog, open, close };
}
