'use client';

import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuItem,
  InputTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { folderPickerQuery as FolderPickerQueryType } from '@/__generated__/folderPickerQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { findFolderName, type FolderTarget, folderMenuItems, ROOT_FOLDER, readFolderTree } from './folder-tree';

/**
 * Every folder of the knowledge base, unpaged — a picker has to offer all of
 * them, at every depth, which the paged listing of one level cannot.
 */
const folderPickerQuery = graphql`
  query folderPickerQuery {
    knowledgeBaseFolderTree {
      ...folderTree_folder
    }
  }
`;

const ROOT_ITEM_ID = '__kb_root__';

interface FolderPickerProps {
  /** The picked folder: its id, null for the root, undefined while nothing is picked. */
  value: string | null | undefined;
  onSelect: (target: FolderTarget) => void;
  placeholder?: string;
  /** Drawn in the trigger in place of a folder's name — for a pick that is not a folder. */
  label?: string;
  /** Options listed above the folders — the picks that are not a folder. */
  leadingItems?: ActionsMenuItem[];
  /** A folder that cannot be picked, with everything under it. */
  excludeFolderId?: string | null;
  disabled?: boolean;
}

/**
 * The one folder picker of the knowledge base: the root, then the folder tree as
 * nested menus. Suspends on the tree — wrap it in `<Suspense>` with
 * `FolderPickerFallback`.
 */
export function FolderPicker({
  value,
  onSelect,
  placeholder = 'Select Folder',
  label,
  leadingItems = [],
  excludeFolderId,
  disabled,
}: FolderPickerProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<FolderPickerQueryType>(
    folderPickerQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const tree = readFolderTree(data.knowledgeBaseFolderTree);

  const pickedName =
    value === undefined ? undefined : value === null ? ROOT_FOLDER.name : (findFolderName(tree, value) ?? undefined);

  return (
    <ActionsMenuDropdown
      groups={[
        {
          items: [
            ...leadingItems,
            { id: ROOT_ITEM_ID, label: ROOT_FOLDER.name, onClick: () => onSelect(ROOT_FOLDER) },
            ...folderMenuItems(tree, onSelect, excludeFolderId),
          ],
        },
      ]}
      align="start"
      side="bottom"
      sideOffset={4}
      contentClassName="z-[1400]"
      customTrigger={
        <InputTrigger
          selectedLabel={label ?? pickedName}
          placeholder={placeholder}
          endIcon={<Chevron02DownIcon className="size-6" />}
          disabled={disabled}
        />
      }
    />
  );
}
