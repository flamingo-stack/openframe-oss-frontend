'use client';

import { ConnectionHandler, graphql, readInlineData, useMutation } from 'react-relay';
import type { SelectorStoreUpdater } from 'relay-runtime';
import type { mailboxErrors_userError$key } from '@/__generated__/mailboxErrors_userError.graphql';
import type { useBlockListMutationsAddMutation as AddMutationType } from '@/__generated__/useBlockListMutationsAddMutation.graphql';
import type { useBlockListMutationsRemoveMutation as RemoveMutationType } from '@/__generated__/useBlockListMutationsRemoveMutation.graphql';
import {
  mailboxErrorsUserErrorFragment,
  mailboxRequestErrorMessage,
  mailboxUserErrorMessage,
} from '../../utils/mailbox-errors';
import { blockListConnectionId } from '../block-list/block-list-table';
import type { BlockListEntryAdd, BlockListEntryRemove } from './save-block-list';

// A new entry goes on top of the details table's list (newest first, `prependEntry`), a removed one leaves it: the
// table shows the save without a refetch when it has been read.
const addMutation = graphql`
  mutation useBlockListMutationsAddMutation($input: AddEmailBlockListEntryInput!) {
    addEmailBlockListEntry(input: $input) {
      entry {
        id
        value
        ...blockListEntryRow_entry
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

const removeMutation = graphql`
  mutation useBlockListMutationsRemoveMutation($input: RemoveEmailBlockListEntryInput!, $connections: [ID!]!) {
    removeEmailBlockListEntry(input: $input) {
      deletedId @deleteEdge(connections: $connections)
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/**
 * Puts an added entry on top of the table's connection. An updater, not `@prependNode`: a refused value answers
 * `entry: null`, which the directive reports as a missing node.
 */
function prependEntry(connectionId: string): SelectorStoreUpdater<AddMutationType['response']> {
  return store => {
    const entry = store.getRootField('addEmailBlockListEntry')?.getLinkedRecord('entry');
    const connection = store.get(connectionId);
    if (!entry || !connection) return;
    const edge = ConnectionHandler.createEdge(store, connection, entry, 'EmailBlockListEntryEdge');
    ConnectionHandler.insertEdgeBefore(connection, edge);
  };
}

/** Removing an entry someone else already removed is what the save wanted anyway. */
const ENTRY_NOT_FOUND = 'EMAIL_BLOCK_LIST_ENTRY_NOT_FOUND';

function codeOf(ref: mailboxErrors_userError$key): string {
  return readInlineData(mailboxErrorsUserErrorFragment, ref).code;
}

/**
 * Adding and removing one Block list entry of a mailbox, each as a promise of its outcome. With no mailbox (the page is
 * still reading it) there is nothing to change: nothing calls them before Save, which is locked until then.
 */
export function useBlockListMutations(mailboxId: string): { add: BlockListEntryAdd; remove: BlockListEntryRemove } {
  const [commitAdd] = useMutation<AddMutationType>(addMutation);
  const [commitRemove] = useMutation<RemoveMutationType>(removeMutation);
  const connectionId = blockListConnectionId(mailboxId);

  const add: BlockListEntryAdd = value =>
    new Promise(resolve => {
      commitAdd({
        variables: { input: { mailboxId, value } },
        updater: prependEntry(connectionId),
        onCompleted: ({ addEmailBlockListEntry: { entry, userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal || !entry) {
            resolve({ error: refusal ? mailboxUserErrorMessage(refusal) : 'Try again in a moment.' });
            return;
          }
          resolve({ entry: { id: entry.id, value: entry.value } });
        },
        onError: error => resolve({ error: mailboxRequestErrorMessage(error) }),
      });
    });

  const remove: BlockListEntryRemove = id =>
    new Promise(resolve => {
      commitRemove({
        variables: { input: { id }, connections: [connectionId] },
        onCompleted: ({ removeEmailBlockListEntry: { userErrors } }) => {
          const [refusal] = userErrors;
          resolve(refusal && codeOf(refusal) !== ENTRY_NOT_FOUND ? { error: mailboxUserErrorMessage(refusal) } : {});
        },
        onError: error => resolve({ error: mailboxRequestErrorMessage(error) }),
      });
    });

  return { add, remove };
}
