'use client';

import { graphql, useFragment } from 'react-relay';
import type { knowledgeBaseItemDialogs_item$key } from '@/__generated__/knowledgeBaseItemDialogs_item.graphql';
import { ArchiveArticleModal } from '../dialogs/archive-article-modal';
import { DeleteFolderModal } from '../dialogs/delete-folder-modal';
import { MoveToFolderModal } from '../dialogs/move-to-folder-modal';
import { RenameFolderModal } from '../dialogs/rename-folder-modal';
import type { ItemDialogKind } from './knowledge-base-item-actions-cell';

const knowledgeBaseItemDialogsFragment = graphql`
  fragment knowledgeBaseItemDialogs_item on KnowledgeBaseItem {
    ...renameFolderModal_folder
    ...moveToFolderModal_item
    ...deleteFolderModal_folder
    ...archiveArticleModal_article
  }
`;

interface KnowledgeBaseItemDialogsProps {
  /** The row the dialog is about. */
  item: knowledgeBaseItemDialogs_item$key;
  kind: ItemDialogKind;
  isOpen: boolean;
  onClose: () => void;
  /** The listings on screen the row is drawn from — an archived or deleted item leaves them at once. */
  listingIds: readonly string[];
}

/** The dialog a row's menu opened, for the listing as a whole — one is open at a time. */
export function KnowledgeBaseItemDialogs({ item, kind, isOpen, onClose, listingIds }: KnowledgeBaseItemDialogsProps) {
  const data = useFragment(knowledgeBaseItemDialogsFragment, item);

  switch (kind) {
    case 'rename':
      return <RenameFolderModal folder={data} isOpen={isOpen} onClose={onClose} />;
    case 'move':
      return <MoveToFolderModal item={data} isOpen={isOpen} onClose={onClose} />;
    case 'delete':
      return <DeleteFolderModal folder={data} isOpen={isOpen} onClose={onClose} listingIds={listingIds} />;
    case 'archive':
      return <ArchiveArticleModal article={data} isOpen={isOpen} onClose={onClose} listingIds={listingIds} />;
  }
}
