'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { archiveArticleModal_article$key } from '@/__generated__/archiveArticleModal_article.graphql';
import type { archiveArticleModalMutation as ArchiveArticleModalMutationType } from '@/__generated__/archiveArticleModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { markListChanged } from '@/lib/list-refresh';

const archiveArticleModalFragment = graphql`
  fragment archiveArticleModal_article on KnowledgeBaseItem {
    id
    name
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

interface ArchiveArticleModalProps {
  article: archiveArticleModal_article$key;
  isOpen: boolean;
  onClose: () => void;
}

export function ArchiveArticleModal({ article, isOpen, onClose }: ArchiveArticleModalProps) {
  const { toast } = useToast();
  const data = useFragment(archiveArticleModalFragment, article);
  const [commit, isInFlight] = useMutation<ArchiveArticleModalMutationType>(archiveArticleModalMutation);

  const handleConfirm = () => {
    commit({
      variables: { id: data.id },
      onCompleted: () => {
        // The article moved from the knowledge base to its archive: both lists read their page again.
        markListChanged('knowledgeBase', 'archivedArticles');
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
