'use client';

import { DataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EMPTY_VALUE, isEmptyValue } from '@/lib/empty-value';

/**
 * A value's cell in a GRID table (`meta.gridCell`): one line of text, or the muted empty mark when there is none.
 * `ValueText` is the same value in a card row. While the row is read (a loading scope) it is the cell's own bar.
 */
export function ValueGridCell({
  value,
  tone,
}: {
  value: string | number | null | undefined;
  /** `secondary` mutes the value: a row whose subject is gone. */
  tone?: 'primary' | 'secondary';
}) {
  if (useLoadingScope()) return <DataTable.Cell text="" />;
  if (isEmptyValue(value)) return <DataTable.Cell text={EMPTY_VALUE} tone="secondary" />;
  return <DataTable.Cell text={String(value)} tone={tone} />;
}
