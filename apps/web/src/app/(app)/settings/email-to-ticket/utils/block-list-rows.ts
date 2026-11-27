// The Block list rows of a mailbox form (contract part D). What a value may be is the server's to say: it answers a
// refused value with a user error naming its field, and the form marks that row. The form only drops blank rows.

import { z } from 'zod';

export interface BlockListRow {
  value: string;
  /** The stored entry the row shows (Edit Mailbox); none for a row typed on this page. */
  entryId?: string;
}

export const blockListRowsSchema = z.array(z.object({ value: z.string(), entryId: z.string().optional() }));

/** A stored entry, as Edit Mailbox reads and saves it. */
export interface StoredBlockListEntry {
  id: string;
  value: string;
}

/** The value a row sends: its text without the spaces around it. */
export function blockListRowValue(row: BlockListRow): string {
  return row.value.trim();
}

/** The values Save Mailbox sends (`activateMailbox.blockList`): blank rows dropped. */
export function blockListValues(rows: readonly BlockListRow[]): string[] {
  return rows.map(blockListRowValue).filter(Boolean);
}

/**
 * The row a refusal of Save Mailbox points at: `blockList.<i>` counts the values sent (blank rows dropped), from zero.
 */
export function blockListRowOfField(rows: readonly BlockListRow[], field: string | null | undefined): number | null {
  const match = field?.match(/^blockList\.(\d+)$/);
  if (!match) return null;
  const sentIndex = Number(match[1]);
  let seen = -1;
  for (const [index, row] of rows.entries()) {
    if (blockListRowValue(row)) seen += 1;
    if (seen === sentIndex) return index;
  }
  return null;
}

/** The rows Edit Mailbox opens with: one per stored entry, newest first as the server lists them. */
export function blockListRowsOf(stored: readonly StoredBlockListEntry[]): BlockListRow[] {
  return stored.map(entry => ({ value: entry.value, entryId: entry.id }));
}
