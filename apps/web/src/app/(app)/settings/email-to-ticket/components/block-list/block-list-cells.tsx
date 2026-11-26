'use client';

import {
  DataTable,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { blockListKindLabel, blockListDroppedLabel } from '../../utils/block-list';
import type { BlockListEntryRow } from './block-list-entry-row';

// A loading scope's rows are placeholders that carry their `id` alone: a cell draws from what the row has.

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

export function SenderGridCell({ row }: { row: BlockListEntryRow }) {
  return <DataTable.Cell text={row.value ?? ''} secondary={row.kind ? blockListKindLabel(row.kind) : undefined} />;
}

/** ADDED BY: the person's avatar and name (Figma settings 6236-119872). Nobody named, a dash. */
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

export function AddedByGridCell({ row }: { row: BlockListEntryRow }) {
  const person = row.addedBy;
  if (!person) return <DataTable.Cell text="—" />;
  return <DataTable.Cell leading={{ type: 'avatar', src: person.avatarUrl, name: person.name }} text={person.name} />;
}

/** DROPPED FOR 30 DAYS: how many emails from this sender were dropped. */
export function DroppedCell({ row }: { row: BlockListEntryRow }) {
  const loading = useLoadingScope();
  return <TruncateText loading={loading}>{blockListDroppedLabel(row.droppedLast30Days ?? 0)}</TruncateText>;
}
