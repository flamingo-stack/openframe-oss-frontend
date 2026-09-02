'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useArchiveArticle } from '../hooks/use-archive-article';
import { ARCHIVED_ARTICLES_CONNECTION_KEY, getArchivedArticlesConnectionId } from '../hooks/use-archived-articles';

export interface ArchiveArticleTarget {
  id: string;
  name: string;
}

interface ArchiveArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: ArchiveArticleTarget | null;
  sourceConnectionId: string;
}

export function ArchiveArticleModal({ isOpen, onClose, article, sourceConnectionId }: ArchiveArticleModalProps) {
  const { toast } = useToast();
  const { archiveArticle, isPending } = useArchiveArticle();

  const handleConfirm = async () => {
    if (!article || isPending) return;
    const archiveConnectionId = getArchivedArticlesConnectionId({ search: null, tagIds: null });
    try {
      await archiveArticle({
        id: article.id,
        removeFromConnections: [sourceConnectionId],
        appendToConnections: [archiveConnectionId],
      });
      toast({ title: 'Article archived', description: article.name, variant: 'success' });
      onClose();
    } catch {
      // The mutation hook already toasts and rejects on failure (see use-archive-article.ts and its siblings). Catching here keeps the rejection from going unhandled and leaves the modal open on the data the user still has, instead of closing it as if the action had succeeded.
    }
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
          Are you sure you want to archive <span className="text-ods-error">{article?.name ?? 'this'}</span> article?
        </>
      }
      confirmLabel="Archive Article"
      pendingLabel="Archiving..."
      variant="destructive"
      isPending={isPending}
      onConfirm={handleConfirm}
    />
  );
}

export { ARCHIVED_ARTICLES_CONNECTION_KEY };
