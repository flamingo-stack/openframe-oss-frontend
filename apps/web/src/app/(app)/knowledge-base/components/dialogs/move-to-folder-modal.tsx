'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { moveToFolderModal_item$key } from '@/__generated__/moveToFolderModal_item.graphql';
import type { moveToFolderModalMutation as MoveToFolderModalMutationType } from '@/__generated__/moveToFolderModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { FolderPicker } from '../shared/folder-picker';
import { FolderPickerFallback } from '../shared/folder-picker-fallback';
import type { FolderTarget } from '../shared/folder-tree';
import { invalidateFolderListing, removeFromFolderListing } from '../shared/knowledge-base-listings';

const moveToFolderModalFragment = graphql`
  fragment moveToFolderModal_item on KnowledgeBaseItem {
    id
    type
    name
    parentId
  }
`;

const moveToFolderModalMutation = graphql`
  mutation moveToFolderModalMutation($id: ID!, $parentId: ID) {
    moveToFolder(id: $id, parentId: $parentId) {
      id
      parentId
      updatedAt
    }
  }
`;

interface MoveToFolderModalProps {
  /** The folder or the article being moved. */
  item: moveToFolderModal_item$key;
  isOpen: boolean;
  onClose: () => void;
}

export function MoveToFolderModal({ item, isOpen, onClose }: MoveToFolderModalProps) {
  const { toast } = useToast();
  const data = useFragment(moveToFolderModalFragment, item);
  const [commit, isInFlight] = useMutation<MoveToFolderModalMutationType>(moveToFolderModalMutation);
  const [target, setTarget] = useState<FolderTarget | null>(null);

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old value on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setTarget(null);
  }

  const handleConfirm = () => {
    if (!target || isInFlight) return;
    const from = data.parentId ?? null;
    commit({
      variables: { id: data.id, parentId: target.id },
      updater: store => {
        if (target.id === from) return;
        // Only the level's own listing loses the row. A search result keeps it: the
        // item still matches, wherever it lives now.
        removeFromFolderListing(store, from, data.id);
        invalidateFolderListing(store, target.id);
      },
      onCompleted: () => {
        toast({ title: 'Moved', description: `${data.name} moved to ${target.name}`, variant: 'success' });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Move failed',
          description: getRelayErrorMessage(error, 'Unable to move item'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="Move to Folder"
      contentClassName="flex flex-col gap-[var(--spacing-system-xxs)] overflow-visible"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isInFlight}>
            Cancel
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!target || isInFlight}
            loading={isInFlight}
          >
            Move
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">Folder Name</p>
      <Suspense fallback={<FolderPickerFallback />}>
        <FolderPicker
          value={target ? target.id : undefined}
          onSelect={setTarget}
          // A folder cannot be moved into itself or into anything under it.
          excludeFolderId={data.type === KnowledgeBaseItemType.FOLDER ? data.id : null}
          disabled={isInFlight}
        />
      </Suspense>
    </SimpleModal>
  );
}
