'use client';

import { LoadingFallback, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuItem,
  InputTrigger,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
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
 * nested menus. It holds its own boundary on the tree: while the tree loads (or
 * in any loading scope) it draws its own loading state, the same control locked.
 */
export function FolderPicker(props: FolderPickerProps) {
  if (useLoadingScope()) {
    return <FolderPickerSkeleton {...props} />;
  }
  return (
    <Suspense
      fallback={
        <LoadingFallback label="Loading folders">
          <FolderPicker {...props} />
        </LoadingFallback>
      }
    >
      <FolderPickerMenu {...props} />
    </Suspense>
  );
}

/**
 * The picker before the tree is in: the same trigger, locked, showing what is known without the tree. A picked
 * folder's name needs the tree, so it is a bar; the root and an unpicked field are known.
 */
function FolderPickerSkeleton({ value, placeholder = 'Select Folder', label }: FolderPickerProps) {
  const selectedLabel =
    label ??
    (value === null ? (
      ROOT_FOLDER.name
    ) : value === undefined ? undefined : (
      <TextLineSkeleton type="inherit" as="span" className="w-32" />
    ));
  return (
    <InputTrigger
      selectedLabel={selectedLabel}
      placeholder={placeholder}
      endIcon={<Chevron02DownIcon className="size-6" />}
      disabled
    />
  );
}

function FolderPickerMenu({
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
