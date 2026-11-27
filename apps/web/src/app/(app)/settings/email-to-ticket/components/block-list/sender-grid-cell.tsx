'use client';

import { DataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { blockListKindLabel } from '../../utils/block-list-presentation';
import type { BlockListEntryRow } from './block-list-entry-row';

/** EMAIL OR DOMAIN in the grid: the value, its kind after it (Figma settings 6236-119872). */
export function SenderGridCell({ row }: { row: BlockListEntryRow }) {
  return <DataTable.Cell text={row.value ?? ''} secondary={row.kind ? blockListKindLabel(row.kind) : undefined} />;
}
