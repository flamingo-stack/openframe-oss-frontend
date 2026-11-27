'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { blockListDroppedLabel } from '../../utils/block-list-presentation';
import type { BlockListEntryRow } from './block-list-entry-row';

/** DROPPED FOR 30 DAYS: how many emails from this sender were dropped. */
export function DroppedCell({ row }: { row: BlockListEntryRow }) {
  const loading = useLoadingScope();
  return <TruncateText loading={loading}>{blockListDroppedLabel(row.droppedLast30Days ?? 0)}</TruncateText>;
}
