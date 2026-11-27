// The order of a save of Edit Mailbox's Block list. Removals go first, so an edited value and its replacement never
// collide as a duplicate; then additions, one at a time in the order of the rows. A refused addition is reported on its
// row and the rest go on; a failed removal stops the save before anything is added.

import { blockListChanges } from '../../utils/block-list-changes';
import type { BlockListRow, StoredBlockListEntry } from '../../utils/block-list-rows';

export type BlockListEntryAdd = (value: string) => Promise<{ entry: StoredBlockListEntry } | { error: string }>;
export type BlockListEntryRemove = (id: string) => Promise<{ error?: string }>;

export interface BlockListSaveResult {
  /** What is stored now, for the next save to compare against. */
  stored: StoredBlockListEntry[];
  /** The form's rows, each pointing at the entry stored for it. */
  rows: BlockListRow[];
  /** Rows the server refused, with why. */
  rowErrors: { index: number; message: string }[];
  /** A removal that failed. */
  error: string | null;
}

export async function saveBlockList(
  stored: readonly StoredBlockListEntry[],
  rows: readonly BlockListRow[],
  { add, remove }: { add: BlockListEntryAdd; remove: BlockListEntryRemove },
): Promise<BlockListSaveResult> {
  const { remove: toRemove, add: toAdd } = blockListChanges(stored, rows);
  const removed = new Set<string>();
  const unlinked = () =>
    rows.map(row => ({ ...row, entryId: row.entryId && removed.has(row.entryId) ? undefined : row.entryId }));
  const remaining = () => stored.filter(entry => !removed.has(entry.id));

  for (const entry of toRemove) {
    const { error } = await remove(entry.id);
    if (error) return { stored: remaining(), rows: unlinked(), rowErrors: [], error };
    removed.add(entry.id);
  }

  const next = unlinked();
  const added: StoredBlockListEntry[] = [];
  const rowErrors: BlockListSaveResult['rowErrors'] = [];
  for (const { index, value } of toAdd) {
    const outcome = await add(value);
    if ('error' in outcome) {
      rowErrors.push({ index, message: outcome.error });
      continue;
    }
    added.push(outcome.entry);
    next[index] = { value: outcome.entry.value, entryId: outcome.entry.id };
  }
  return { stored: [...remaining(), ...added], rows: next, rowErrors, error: null };
}
