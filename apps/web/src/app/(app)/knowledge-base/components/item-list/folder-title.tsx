'use client';

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { folderTitle_folder$key } from '@/__generated__/folderTitle_folder.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { DeleteFolderModal } from '../dialogs/delete-folder-modal';
import { MoveToFolderModal } from '../dialogs/move-to-folder-modal';
import { RenameFolderModal } from '../dialogs/rename-folder-modal';
import { type FolderDialogKind, folderMenuGroups } from './folder-menu';
import { KnowledgeBaseListTitle } from './knowledge-base-list-title';

const folderTitleFragment = graphql`
  fragment folderTitle_folder on KnowledgeBaseItem {
    name
    parentId
    ...renameFolderModal_folder
    ...moveToFolderModal_item
    ...deleteFolderModal_folder
  }
`;

interface FolderTitleProps {
  folder: folderTitle_folder$key;
  actions: PageActionButton[];
}

/**
 * The title row of a folder's page: its name, Back to the level above, and the
 * folder's own menu. Deleting the folder leaves the page the same way Back does.
 */
export function FolderTitle({ folder, actions }: FolderTitleProps) {
  const data = useFragment(folderTitleFragment, folder);
  const parentUrl = data.parentId ? routes.knowledgeBase.folder(data.parentId) : routes.knowledgeBase.list;
  const leave = useSafeBack(parentUrl);
  const [dialog, setDialog] = useState<FolderDialogKind | null>(null);
  const closeDialog = () => setDialog(null);

  return (
    <>
      <KnowledgeBaseListTitle
        title={data.name}
        backTo={parentUrl}
        actions={actions}
        menuActions={folderMenuGroups(setDialog)}
      />
      <RenameFolderModal folder={data} isOpen={dialog === 'rename'} onClose={closeDialog} />
      <MoveToFolderModal item={data} isOpen={dialog === 'move'} onClose={closeDialog} />
      <DeleteFolderModal folder={data} isOpen={dialog === 'delete'} onClose={closeDialog} onDeleted={leave} />
    </>
  );
}
