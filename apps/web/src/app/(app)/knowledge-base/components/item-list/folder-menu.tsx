import { FolderEditIcon, PenEditIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuGroup } from '@flamingo-stack/openframe-frontend-core/components/ui';

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

/** The dialogs a folder's menu opens. */
export type FolderDialogKind = 'rename' | 'move' | 'delete';

/**
 * What can be done to a folder. One menu for the two places that offer it: the
 * folder's row in a listing and the header of the folder's own page.
 */
export function folderMenuGroups(onOpen: (dialog: FolderDialogKind) => void): ActionsMenuGroup[] {
  return [
    {
      items: [
        {
          id: 'rename',
          label: 'Rename',
          icon: <PenEditIcon className={ICON_CLASS} />,
          onClick: () => onOpen('rename'),
        },
        {
          id: 'move',
          label: 'Move folder',
          icon: <FolderEditIcon className={ICON_CLASS} />,
          onClick: () => onOpen('move'),
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: <TrashIcon className={ICON_CLASS} />,
          onClick: () => onOpen('delete'),
        },
      ],
    },
  ];
}
