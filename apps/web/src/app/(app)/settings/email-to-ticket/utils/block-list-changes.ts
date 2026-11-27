// What a save of Edit Mailbox's Block list changes: the API adds and removes entries one by one (contract part D).

import { type BlockListRow, blockListRowValue, type StoredBlockListEntry } from './block-list-rows';

export interface BlockListChanges {
  /** Stored entries to remove: dropped from the list, or edited into another value. */
  remove: StoredBlockListEntry[];
  /** Values to add, each with the form row it came from. */
  add: { index: number; value: string }[];
}

/** A row keeps its stored entry while its value is unchanged; an edited row is that entry removed and the value added. */
export function blockListChanges(
  stored: readonly StoredBlockListEntry[],
  rows: readonly BlockListRow[],
): BlockListChanges {
  const byId = new Map(stored.map(entry => [entry.id, entry]));
  const kept = new Set<string>();
  const add: BlockListChanges['add'] = [];
  rows.forEach((row, index) => {
    const value = blockListRowValue(row);
    const entry = row.entryId ? byId.get(row.entryId) : undefined;
    if (entry && entry.value === value) {
      kept.add(entry.id);
      return;
    }
    if (value) add.push({ index, value });
  });
  return { remove: stored.filter(entry => !kept.has(entry.id)), add };
}
