'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { deleteFolderModal_folder$key } from '@/__generated__/deleteFolderModal_folder.graphql';
import type { deleteFolderModalMutation as DeleteFolderModalMutationType } from '@/__generated__/deleteFolderModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { FolderChildrenAction } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { markListChanged } from '@/lib/list-refresh';
import { FolderPicker } from '../shared/folder-picker';
import type { FolderTarget } from '../shared/folder-tree';
import { removeFromFolderTree } from '../shared/knowledge-base-listings';

const deleteFolderModalFragment = graphql`
  fragment deleteFolderModal_folder on KnowledgeBaseItem {
    id
    name
  }
`;

const deleteFolderModalMutation = graphql`
  mutation deleteFolderModalMutation($input: DeleteFolderInput!) {
    deleteFolder(input: $input)
  }
`;

const ARCHIVE_LABEL = "Don't Move and Archive";

interface DeleteFolderModalProps {
  folder: deleteFolderModal_folder$key;
  isOpen: boolean;
  onClose: () => void;
  /** After the folder is gone — the folder's own page has to leave. */
  onDeleted?: () => void;
}

export function DeleteFolderModal({ folder, isOpen, onClose, onDeleted }: DeleteFolderModalProps) {
  const { toast } = useToast();
  const data = useFragment(deleteFolderModalFragment, folder);
  const [commit, isInFlight] = useMutation<DeleteFolderModalMutationType>(deleteFolderModalMutation);
  /** Where the folder's contents go; null archives them instead. */
  const [destination, setDestination] = useState<FolderTarget | null>(null);

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old value on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setDestination(null);
  }

  const handleConfirm = () => {
    commit({
      variables: {
        input: {
          id: data.id,
          childrenAction: destination ? FolderChildrenAction.MOVE : FolderChildrenAction.ARCHIVE,
          moveTargetFolderId: destination?.id ?? null,
        },
      },
      updater: store => removeFromFolderTree(store, data.id),
      onCompleted: () => {
        // The folder left its level and its contents went to another folder or to the archive: those lists read their
        // page again.
        markListChanged('knowledgeBase');
        if (!destination) markListChanged('archivedArticles');
        toast({ title: 'Folder deleted', description: data.name, variant: 'success' });
        onDeleted?.();
        onClose();
      },
      onError: error => {
        toast({
          title: 'Delete failed',
          description: getRelayErrorMessage(error, 'Unable to delete folder'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Delete Folder"
      description={
        <>
          Are you sure you want to delete <span className="text-ods-error">{data.name}</span> folder? All articles
          inside will be archived or moved.
        </>
      }
      confirmLabel="Delete Folder"
      variant="destructive"
      isPending={isInFlight}
      onConfirm={handleConfirm}
      extraContent={
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h4">Move Articles to</p>
          <FolderPicker
            value={destination ? destination.id : undefined}
            label={destination ? undefined : ARCHIVE_LABEL}
            onSelect={setDestination}
            leadingItems={[{ id: '__archive__', label: ARCHIVE_LABEL, onClick: () => setDestination(null) }]}
            excludeFolderId={data.id}
            disabled={isInFlight}
          />
        </div>
      }
    />
  );
}
