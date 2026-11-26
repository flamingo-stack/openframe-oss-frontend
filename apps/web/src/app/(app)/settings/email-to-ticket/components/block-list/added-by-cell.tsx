'use client';

import {
  DataTable,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import type { BlockListEntryRow } from './block-list-entry-row';

/** ADDED BY in card rows: the person's avatar and name. Nobody named, a dash. */
export function AddedByCell({ row }: { row: BlockListEntryRow }) {
  const loading = useLoadingScope();
  const person = row.addedBy;
  if (loading) return <DataTable.Cell leading={{ type: 'avatar', name: '' }} text="" />;
  if (!person) return <TruncateText tone="secondary">—</TruncateText>;
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      {person.deleted ? (
        <DeletedUserAvatar size="sm" />
      ) : (
        <SquareAvatar src={person.avatarUrl} fallback={person.name} size="sm" variant="round" />
      )}
      <TruncateText>{person.name}</TruncateText>
    </div>
  );
}
