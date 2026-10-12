'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { unarchiveArticleModal_article$key } from '@/__generated__/unarchiveArticleModal_article.graphql';
import type { unarchiveArticleModalMutation as UnarchiveArticleModalMutationType } from '@/__generated__/unarchiveArticleModalMutation.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { FolderPicker } from '../shared/folder-picker';
import { FolderPickerFallback } from '../shared/folder-picker-fallback';
import { type FolderTarget, ROOT_FOLDER } from '../shared/folder-tree';
import {
  invalidateArchiveListing,
  invalidateFolderListing,
  removeFromListings,
} from '../shared/knowledge-base-listings';

const unarchiveArticleModalFragment = graphql`
  fragment unarchiveArticleModal_article on KnowledgeBaseItem {
    id
    name
  }
`;

const unarchiveArticleModalMutation = graphql`
  mutation unarchiveArticleModalMutation($id: ID!, $parentId: ID) {
    unarchiveArticle(id: $id, parentId: $parentId) {
      id
      status
      parentId
      parent {
        name
      }
      updatedAt
    }
  }
`;

const NO_LISTINGS: readonly string[] = [];

interface UnarchiveArticleModalProps {
  article: unarchiveArticleModal_article$key;
  isOpen: boolean;
  onClose: () => void;
  /** The archive listings on screen that show the article. */
  listingIds?: readonly string[];
}

export function UnarchiveArticleModal({
  article,
  isOpen,
  onClose,
  listingIds = NO_LISTINGS,
}: UnarchiveArticleModalProps) {
  const { toast } = useToast();
  const data = useFragment(unarchiveArticleModalFragment, article);
  const [commit, isInFlight] = useMutation<UnarchiveArticleModalMutationType>(unarchiveArticleModalMutation);
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
    commit({
      variables: { id: data.id, parentId: target.id },
      updater: store => {
        removeFromListings(store, listingIds, data.id);
        invalidateArchiveListing(store);
        invalidateFolderListing(store, target.id);
      },
      onCompleted: () => {
        toast({ title: 'Unarchived', description: `${data.name} restored`, variant: 'success' });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Unarchive failed',
          description: getRelayErrorMessage(error, 'Unable to unarchive article'),
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
      title="Unarchive Article"
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
            Unarchive
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">Restore To</p>
      <Suspense fallback={<FolderPickerFallback placeholder={ROOT_FOLDER.name} />}>
        <FolderPicker
          value={target ? target.id : undefined}
          onSelect={setTarget}
          placeholder={ROOT_FOLDER.name}
          disabled={isInFlight}
        />
      </Suspense>
    </SimpleModal>
  );
}
