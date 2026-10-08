'use client';

import {
  BoxArchiveIcon,
  FileEditIcon,
  FolderEditIcon,
  PenEditIcon,
  Refresh01LeftIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useState } from 'react';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { useArticleDetailActions_article$key } from '@/__generated__/useArticleDetailActions_article.graphql';
import type { useArticleDetailActionsPublishMutation as PublishMutationType } from '@/__generated__/useArticleDetailActionsPublishMutation.graphql';
import type { useArticleDetailActionsUnpublishMutation as UnpublishMutationType } from '@/__generated__/useArticleDetailActionsUnpublishMutation.graphql';
import { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { ArchiveArticleModal } from '../dialogs/archive-article-modal';
import { MoveToFolderModal } from '../dialogs/move-to-folder-modal';
import { UnarchiveArticleModal } from '../dialogs/unarchive-article-modal';
import { toArticleStatus } from '../shared/article-status';

const useArticleDetailActionsFragment = graphql`
  fragment useArticleDetailActions_article on KnowledgeBaseItem {
    id
    name
    status
    ...archiveArticleModal_article
    ...moveToFolderModal_item
    ...unarchiveArticleModal_article
  }
`;

// Both select what the summary card draws, so the page turns over in place.
const publishMutation = graphql`
  mutation useArticleDetailActionsPublishMutation($id: ID!) {
    publishArticle(id: $id) {
      id
      status
      publishedAt
      updatedAt
    }
  }
`;

const unpublishMutation = graphql`
  mutation useArticleDetailActionsUnpublishMutation($id: ID!) {
    unpublishArticle(id: $id) {
      id
      status
      publishedAt
      updatedAt
    }
  }
`;

const ACTION_ICON_CLASS = 'text-ods-text-secondary';
const MENU_ICON_CLASS = 'h-6 w-6 text-ods-text-secondary';

type ArticleDialog = 'archive' | 'move' | 'unarchive';

interface ArticleDetailActions {
  actions: PageActionButton[];
  menuActions: ActionsMenuGroup[];
  /** The dialogs the actions open — render them once, under the page. */
  dialogs: ReactNode;
}

/**
 * What the article page offers, by the article's status: an archived article can
 * only be restored; a live one is edited, moved and archived, a draft is
 * published and a published one sent back to draft.
 */
export function useArticleDetailActions(article: useArticleDetailActions_article$key): ArticleDetailActions {
  const { toast } = useToast();
  const data = useFragment(useArticleDetailActionsFragment, article);
  const [commitPublish, isPublishing] = useMutation<PublishMutationType>(publishMutation);
  const [commitUnpublish, isUnpublishing] = useMutation<UnpublishMutationType>(unpublishMutation);
  const [dialog, setDialog] = useState<ArticleDialog | null>(null);
  const closeDialog = () => setDialog(null);

  const status = toArticleStatus(data.status);

  const handlePublish = () => {
    commitPublish({
      variables: { id: data.id },
      onCompleted: () => {
        toast({ title: 'Published', description: data.name, variant: 'success' });
      },
      onError: error => {
        toast({
          title: 'Publish failed',
          description: getRelayErrorMessage(error, 'Unable to publish article'),
          variant: 'destructive',
        });
      },
    });
  };

  const handleUnpublish = () => {
    commitUnpublish({
      variables: { id: data.id },
      onCompleted: () => {
        toast({ title: 'Moved to draft', description: data.name, variant: 'success' });
      },
      onError: error => {
        toast({
          title: 'Unpublish failed',
          description: getRelayErrorMessage(error, 'Unable to unpublish article'),
          variant: 'destructive',
        });
      },
    });
  };

  const dialogs = (
    <>
      <ArchiveArticleModal article={data} isOpen={dialog === 'archive'} onClose={closeDialog} />
      <MoveToFolderModal item={data} isOpen={dialog === 'move'} onClose={closeDialog} />
      <UnarchiveArticleModal article={data} isOpen={dialog === 'unarchive'} onClose={closeDialog} />
    </>
  );

  if (status === KnowledgeBaseArticleStatus.ARCHIVED) {
    return {
      actions: [
        {
          label: 'Unarchive',
          onClick: () => setDialog('unarchive'),
          icon: <Refresh01LeftIcon size={24} className={ACTION_ICON_CLASS} />,
          variant: 'outline',
        },
      ],
      menuActions: [],
      dialogs,
    };
  }

  const actions: PageActionButton[] = [
    {
      label: 'Edit Article',
      href: routes.knowledgeBase.edit(data.id),
      icon: <PenEditIcon size={24} className={ACTION_ICON_CLASS} />,
      variant: 'outline',
    },
  ];
  if (status === KnowledgeBaseArticleStatus.DRAFT) {
    actions.push({
      label: 'Publish Article',
      onClick: handlePublish,
      variant: 'accent',
      disabled: isPublishing,
      loading: isPublishing,
    });
  }

  const menuItems: ActionsMenuGroup['items'] = [
    {
      id: 'archive',
      label: 'Archive',
      icon: <BoxArchiveIcon className={MENU_ICON_CLASS} />,
      onClick: () => setDialog('archive'),
    },
    {
      id: 'move-to-folder',
      label: 'Move to Folder',
      icon: <FolderEditIcon className={MENU_ICON_CLASS} />,
      onClick: () => setDialog('move'),
    },
  ];
  if (status === KnowledgeBaseArticleStatus.PUBLISHED) {
    menuItems.push({
      id: 'move-to-draft',
      label: 'Move to Draft',
      icon: <FileEditIcon className={MENU_ICON_CLASS} />,
      onClick: handleUnpublish,
      disabled: isUnpublishing,
    });
  }

  return { actions, menuActions: [{ items: menuItems }], dialogs };
}
