'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { archiveArticleModal_article$key } from '@/__generated__/archiveArticleModal_article.graphql';
import type { archiveArticleModalMutation as ArchiveArticleModalMutationType } from '@/__generated__/archiveArticleModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import {
  invalidateArchiveListing,
  removeFromFolderListing,
  removeFromListings,
} from '../shared/knowledge-base-listings';

const archiveArticleModalFragment = graphql`
  fragment archiveArticleModal_article on KnowledgeBaseItem {
    id
    name
    parentId
  }
`;

const archiveArticleModalMutation = graphql`
  mutation archiveArticleModalMutation($id: ID!) {
    archiveArticle(id: $id) {
      id
      status
      updatedAt
    }
  }
`;

const NO_LISTINGS: readonly string[] = [];

interface ArchiveArticleModalProps {
  article: archiveArticleModal_article$key;
  isOpen: boolean;
  onClose: () => void;
  /** The listings on screen that show the article — a search result as much as its own level. */
  listingIds?: readonly string[];
}

export function ArchiveArticleModal({ article, isOpen, onClose, listingIds = NO_LISTINGS }: ArchiveArticleModalProps) {
  const { toast } = useToast();
  const data = useFragment(archiveArticleModalFragment, article);
  const [commit, isInFlight] = useMutation<ArchiveArticleModalMutationType>(archiveArticleModalMutation);

  const handleConfirm = () => {
    commit({
      variables: { id: data.id },
      updater: store => {
        removeFromListings(store, listingIds, data.id);
        removeFromFolderListing(store, data.parentId ?? null, data.id);
        invalidateArchiveListing(store);
      },
      onCompleted: () => {
        toast({ title: 'Article archived', description: data.name, variant: 'success' });
        onClose();
      },
      onError: error => {
        toast({
          title: 'Archive failed',
          description: getRelayErrorMessage(error, 'Unable to archive article'),
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
      title="Archive Article"
      description={
        <>
          Are you sure you want to archive <span className="text-ods-error">{data.name}</span> article?
        </>
      }
      confirmLabel="Archive Article"
      variant="destructive"
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
