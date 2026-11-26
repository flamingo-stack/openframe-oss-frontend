import { graphql, readInlineData } from 'react-relay';
import type { mailboxErrors_userError$key } from '@/__generated__/mailboxErrors_userError.graphql';
import type { saveBlockListAddMutation as AddMutationType } from '@/__generated__/saveBlockListAddMutation.graphql';
import type { saveBlockListRemoveMutation as RemoveMutationType } from '@/__generated__/saveBlockListRemoveMutation.graphql';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import {
  type BlockListRow,
  blockListChanges,
  normalizeBlockListValue,
  type StoredBlockListEntry,
} from '../../utils/block-list';
import {
  mailboxErrorsUserErrorFragment,
  mailboxRequestErrorMessage,
  mailboxUserErrorMessage,
} from '../../utils/mailbox-errors';

const addMutation = graphql`
  mutation saveBlockListAddMutation($input: AddEmailBlockListEntryInput!) {
    addEmailBlockListEntry(input: $input) {
      entry {
        id
        value
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

// The entry leaves the store, so a Block list read before shows it gone without a refetch.
const removeMutation = graphql`
  mutation saveBlockListRemoveMutation($input: RemoveEmailBlockListEntryInput!) {
    removeEmailBlockListEntry(input: $input) {
      deletedId @deleteRecord
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/** Removing an entry someone else already removed is what the save wanted anyway. */
const ENTRY_NOT_FOUND = 'EMAIL_BLOCK_LIST_ENTRY_NOT_FOUND';

export interface BlockListSaveResult {
  /** What is stored now, for the next save to compare against. */
  stored: StoredBlockListEntry[];
  /** The form's rows, each pointing at the entry stored for it. */
  rows: BlockListRow[];
  /** Rows the server refused, with why. */
  rowErrors: { index: number; message: string }[];
  /** A removal that failed: the save stops before adding anything. */
  error: string | null;
}

/**
 * Saves Edit Mailbox's Block list: removals first (an edited value and its replacement never collide as a duplicate),
 * then additions, one at a time in the order of the rows. A refused addition is reported on its row; the rest go on.
 */
export async function saveBlockList(
  mailboxId: string,
  stored: readonly StoredBlockListEntry[],
  rows: readonly BlockListRow[],
): Promise<BlockListSaveResult> {
  const { remove, add } = blockListChanges(stored, rows);
  const removed = new Set<string>();
  for (const entry of remove) {
    try {
      const { removeEmailBlockListEntry } = await commitMutationPromise<RemoveMutationType>(removeMutation, {
        input: { id: entry.id },
      });
      const [refusal] = removeEmailBlockListEntry.userErrors;
      if (refusal && codeOf(refusal) !== ENTRY_NOT_FOUND) {
        return halted(stored, rows, removed, mailboxUserErrorMessage(refusal));
      }
      removed.add(entry.id);
    } catch (error) {
      return halted(stored, rows, removed, mailboxRequestErrorMessage(error));
    }
  }

  const next = rows.map(row => ({
    ...row,
    entryId: row.entryId && removed.has(row.entryId) ? undefined : row.entryId,
  }));
  const added: StoredBlockListEntry[] = [];
  const rowErrors: BlockListSaveResult['rowErrors'] = [];
  for (const { index, value } of add) {
    try {
      const { addEmailBlockListEntry } = await commitMutationPromise<AddMutationType>(addMutation, {
        input: { mailboxId, value },
      });
      const [refusal] = addEmailBlockListEntry.userErrors;
      const entry = addEmailBlockListEntry.entry;
      if (refusal || !entry) {
        rowErrors.push({ index, message: refusal ? mailboxUserErrorMessage(refusal) : 'Try again in a moment.' });
        continue;
      }
      added.push({ id: entry.id, value: entry.value });
      next[index] = { value: entry.value, entryId: entry.id };
    } catch (error) {
      rowErrors.push({ index, message: mailboxRequestErrorMessage(error) });
    }
  }
  return {
    stored: [...stored.filter(entry => !removed.has(entry.id)), ...added],
    rows: next,
    rowErrors,
    error: null,
  };
}

function codeOf(ref: mailboxErrors_userError$key): string {
  return readInlineData(mailboxErrorsUserErrorFragment, ref).code;
}

/** A removal failed: what is stored is what was before, less what was already removed. */
function halted(
  stored: readonly StoredBlockListEntry[],
  rows: readonly BlockListRow[],
  removed: ReadonlySet<string>,
  error: string,
): BlockListSaveResult {
  return {
    stored: stored.filter(entry => !removed.has(entry.id)),
    rows: rows.map(row => ({
      value: row.value,
      entryId: row.entryId && removed.has(row.entryId) ? undefined : row.entryId,
    })),
    rowErrors: [],
    error,
  };
}

/** The rows Edit Mailbox opens with: one per stored entry, newest first as the server lists them. */
export function blockListRowsOf(stored: readonly StoredBlockListEntry[]): BlockListRow[] {
  return stored.map(entry => ({ value: normalizeBlockListValue(entry.value), entryId: entry.id }));
}
