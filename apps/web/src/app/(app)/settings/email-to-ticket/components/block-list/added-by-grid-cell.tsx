'use client';

import { DataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { BlockListEntryRow } from './block-list-entry-row';

/** ADDED BY in the grid: avatar and name on one line (Figma settings 6236-119872). Nobody named, a dash. */
export function AddedByGridCell({ row }: { row: BlockListEntryRow }) {
  const person = row.addedBy;
  if (!person) return <DataTable.Cell text="—" />;
  return <DataTable.Cell leading={{ type: 'avatar', src: person.avatarUrl, name: person.name }} text={person.name} />;
}
