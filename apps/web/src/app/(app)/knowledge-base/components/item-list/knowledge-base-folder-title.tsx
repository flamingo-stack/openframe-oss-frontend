'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { knowledgeBaseFolderTitleQuery as KnowledgeBaseFolderTitleQueryType } from '@/__generated__/knowledgeBaseFolderTitleQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { FolderTitle } from './folder-title';
import { KnowledgeBaseListTitle } from './knowledge-base-list-title';

const knowledgeBaseFolderTitleQuery = graphql`
  query knowledgeBaseFolderTitleQuery($id: ID!) {
    knowledgeBaseItem(id: $id) {
      type
      ...folderTitle_folder
    }
  }
`;

interface KnowledgeBaseFolderTitleProps {
  folderId: string;
  actions: PageActionButton[];
}

/**
 * The one part of a folder's page that waits for the folder itself, with its own boundary. The rows
 * below ask by id, so they load beside this island rather than behind it.
 */
export function KnowledgeBaseFolderTitle(props: KnowledgeBaseFolderTitleProps) {
  return (
    <LoadingSuspense live label="Loading the folder">
      <KnowledgeBaseFolderTitleReader {...props} />
    </LoadingSuspense>
  );
}

function KnowledgeBaseFolderTitleReader(props: KnowledgeBaseFolderTitleProps) {
  // The folder's name is read: in the scope the title draws it as its bar ('' is a read title there).
  if (useLoadingScope()) {
    return <KnowledgeBaseListTitle title="" backTo={routes.knowledgeBase.list} actions={props.actions} />;
  }
  return <KnowledgeBaseFolderTitleLive {...props} />;
}

function KnowledgeBaseFolderTitleLive({ folderId, actions }: KnowledgeBaseFolderTitleProps) {
  const retryKey = useRetryKey();
  const { knowledgeBaseItem: folder } = useLazyLoadQuery<KnowledgeBaseFolderTitleQueryType>(
    knowledgeBaseFolderTitleQuery,
    { id: folderId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // An unknown id, or an article's: there is no folder to list.
  if (folder?.type !== KnowledgeBaseItemType.FOLDER) {
    notFound();
  }

  return <FolderTitle folder={folder} actions={actions} />;
}
