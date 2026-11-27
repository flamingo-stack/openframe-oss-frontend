'use client';

import { graphql, useMutation } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { useScriptArchiveArchiveMutation as ArchiveMutationType } from '@/__generated__/useScriptArchiveArchiveMutation.graphql';
import type { useScriptArchiveUnarchiveMutation as UnarchiveMutationType } from '@/__generated__/useScriptArchiveUnarchiveMutation.graphql';
import { markListChanged } from '@/lib/list-refresh';

// `status` is for the script's own page, which stays mounted on the script: the payload writes the new status into
// the record, so its header flips without a refetch. The lists read their page again instead.
const archiveMutation = graphql`
  mutation useScriptArchiveArchiveMutation($id: ID!) {
    archiveScript(id: $id) {
      id
      status
    }
  }
`;

const unarchiveMutation = graphql`
  mutation useScriptArchiveUnarchiveMutation($id: ID!) {
    unarchiveScript(id: $id) {
      id
      status
    }
  }
`;

interface SetArchivedOptions {
  /** Runs on the store with the answer. */
  updater?: (store: RecordSourceSelectorProxy) => void;
  onCompleted?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Archive and unarchive for a script, from the scripts table and the script's page. Either one moves the script from
 * one paged list to the other, which only the server can answer: on success the scripts lists are marked changed
 * (`markListChanged`), so the one on screen reads its page again.
 */
export function useScriptArchive() {
  const [commitArchive, isArchiving] = useMutation<ArchiveMutationType>(archiveMutation);
  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveMutationType>(unarchiveMutation);

  /** Archives the script (`archive: true`) or puts it back (`false`). */
  const setArchived = (id: string, archive: boolean, { updater, onCompleted, onError }: SetArchivedOptions = {}) => {
    const commit = archive ? commitArchive : commitUnarchive;
    commit({
      variables: { id },
      updater,
      onCompleted: () => {
        markListChanged('scripts');
        onCompleted?.();
      },
      onError,
    });
  };

  return { setArchived, isArchiving, isUnarchiving };
}
