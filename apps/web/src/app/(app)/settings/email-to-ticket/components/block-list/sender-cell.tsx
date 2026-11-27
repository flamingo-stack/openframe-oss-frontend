'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { blockListKindLabel } from '../../utils/block-list-presentation';
import type { BlockListEntryRow } from './block-list-entry-row';

/** EMAIL OR DOMAIN in card rows: the value, and whether it is an address or a domain under it. */
export function SenderCell({ row }: { row: BlockListEntryRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText className={loading ? 'w-48' : undefined}>{row.value ?? ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary" className={loading ? 'w-16' : undefined}>
        {row.kind ? blockListKindLabel(row.kind) : ''}
      </TruncateText>
    </div>
  );
}
