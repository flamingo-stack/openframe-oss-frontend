'use client';

import {
  BoxArchiveIcon,
  FolderEditIcon,
  PenEditIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { knowledgeBaseItemActionsCell_item$key } from '@/__generated__/knowledgeBaseItemActionsCell_item.graphql';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { type FolderDialogKind, folderMenuGroups } from './folder-menu';

const knowledgeBaseItemActionsCellFragment = graphql`
  fragment knowledgeBaseItemActionsCell_item on KnowledgeBaseItem {
    id
    type
  }
`;

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

/** The dialogs a row's menu opens — a folder's, or an article's. */
export type ItemDialogKind = FolderDialogKind | 'archive';

/** An article is edited on its own page; moving and archiving are dialogs. */
function articleMenuGroups(articleId: string, onOpen: (dialog: ItemDialogKind) => void): ActionsMenuGroup[] {
  return [
    {
      items: [
        {
          id: 'edit',
          label: 'Edit',
          icon: <PenEditIcon className={ICON_CLASS} />,
          href: routes.knowledgeBase.edit(articleId),
        },
        {
          id: 'move',
          label: 'Move to folder',
          icon: <FolderEditIcon className={ICON_CLASS} />,
          onClick: () => onOpen('move'),
        },
        {
          id: 'archive',
          label: 'Archive',
          icon: <BoxArchiveIcon className={ICON_CLASS} />,
          onClick: () => onOpen('archive'),
        },
      ],
    },
  ];
}

interface KnowledgeBaseItemActionsCellProps {
  item: knowledgeBaseItemActionsCell_item$key;
  /** The table opens the dialog — see `useRowDialog` for why it is not the row's. */
  onOpen: (dialog: ItemDialogKind) => void;
}

/**
 * The row's ⋯ menu — a folder's or an article's. `data-no-row-click` keeps the
 * row's own link from firing underneath it.
 */
export function KnowledgeBaseItemActionsCell({ item, onOpen }: KnowledgeBaseItemActionsCellProps) {
  const data = useFragment(knowledgeBaseItemActionsCellFragment, item);
  const groups =
    data.type === KnowledgeBaseItemType.FOLDER ? folderMenuGroups(onOpen) : articleMenuGroups(data.id, onOpen);

  return (
    <div data-no-row-click className="pointer-events-auto flex justify-end">
      <ActionsMenuDropdown groups={groups} />
    </div>
  );
}
