'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ActionsMenuDropdown, Button, InputTrigger } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useMemo, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import {
  buildFolderTree,
  getKnowledgeBaseArticlesConnectionId,
  KNOWLEDGE_BASE_ROOT_LABEL,
  useKnowledgeBaseFolders,
} from '../hooks/use-knowledge-base-items';
import { useUnarchiveArticle } from '../hooks/use-unarchive-article';
import { buildFolderMenuItemsWithRoot, type FolderMenuTarget } from './folder-menu-items';

export interface UnarchiveArticleTarget {
  id: string;
  name: string;
}

interface UnarchiveArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: UnarchiveArticleTarget | null;
  sourceConnectionId: string;
}

interface FolderPickerProps {
  selected: FolderMenuTarget | null;
  onSelect: (target: FolderMenuTarget) => void;
}

function FolderPicker({ selected, onSelect }: FolderPickerProps) {
  const folders = useKnowledgeBaseFolders();
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const groups = useMemo(() => [{ items: buildFolderMenuItemsWithRoot(tree, onSelect) }], [tree, onSelect]);

  return (
    <ActionsMenuDropdown
      groups={groups}
      align="start"
      side="bottom"
      sideOffset={4}
      contentClassName="z-[1400]"
      customTrigger={
        <InputTrigger
          selectedLabel={selected?.name}
          placeholder={KNOWLEDGE_BASE_ROOT_LABEL}
          endIcon={<Chevron02DownIcon className="size-6" />}
        />
      }
    />
  );
}

function FolderPickerSkeleton() {
  return <div className="h-12 w-full animate-pulse rounded-[6px] bg-ods-card" />;
}

export function UnarchiveArticleModal({ isOpen, onClose, article, sourceConnectionId }: UnarchiveArticleModalProps) {
  const { toast } = useToast();
  const { unarchiveArticle, isPending } = useUnarchiveArticle();
  const [selected, setSelected] = useState<FolderMenuTarget | null>(null);

  // Cleared on the close transition, during render rather than in an effect: an
  // effect leaves the old value on screen for a frame of the closing animation.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setSelected(null);
  }

  const handleConfirm = async () => {
    if (!article || !selected || isPending) return;
    const targetConnectionId =
      selected.id === null
        ? null
        : getKnowledgeBaseArticlesConnectionId({ parentId: selected.id, search: null, tagIds: [] });
    try {
      await unarchiveArticle({
        id: article.id,
        parentId: selected.id,
        removeFromConnections: [sourceConnectionId],
        appendToConnections: targetConnectionId ? [targetConnectionId] : [],
      });
      toast({ title: 'Unarchived', description: `${article.name} restored`, variant: 'success' });
      onClose();
    } catch {
      // The mutation hook already toasts and rejects on failure (see use-archive-article.ts and its siblings). Catching here keeps the rejection from going unhandled and leaves the modal open on the data the user still has, instead of closing it as if the action had succeeded.
    }
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
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="accent"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!selected || !article || isPending}
            loading={isPending}
          >
            {isPending ? 'Restoring...' : 'Unarchive'}
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">Restore To</p>
      {article ? (
        <Suspense fallback={<FolderPickerSkeleton />}>
          <FolderPicker selected={selected} onSelect={setSelected} />
        </Suspense>
      ) : (
        <FolderPickerSkeleton />
      )}
    </SimpleModal>
  );
}
