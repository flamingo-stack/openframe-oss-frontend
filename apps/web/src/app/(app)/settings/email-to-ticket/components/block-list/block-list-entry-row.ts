import { graphql, readInlineData } from 'react-relay';
import type { blockListEntryRow_entry$key } from '@/__generated__/blockListEntryRow_entry.graphql';
import { toUserSummary, type UserSummary } from '@/graphql/users/user-summary-fields';

/** One row of a mailbox's Block list, as its cells read it. */
export const blockListEntryRowFragment = graphql`
  fragment blockListEntryRow_entry on EmailBlockListEntry @inline {
    id
    value
    kind
    droppedLast30Days
    addedBy {
      ...userSummaryFields_user
    }
  }
`;

export interface BlockListEntryRow {
  id: string;
  value?: string;
  kind?: string;
  droppedLast30Days?: number;
  /** Null when the person who added it is gone from the tenant. */
  addedBy?: UserSummary | null;
}

export function toBlockListEntryRow(ref: blockListEntryRow_entry$key): BlockListEntryRow {
  const { id, value, kind, droppedLast30Days, addedBy } = readInlineData(blockListEntryRowFragment, ref);
  return { id, value, kind, droppedLast30Days, addedBy: addedBy ? toUserSummary(addedBy) : null };
}

export const getBlockListEntryRowId = (row: BlockListEntryRow) => row.id;
