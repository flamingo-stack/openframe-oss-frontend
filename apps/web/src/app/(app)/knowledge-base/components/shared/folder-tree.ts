import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type { folderTree_folder$key } from '@/__generated__/folderTree_folder.graphql';

const folderTreeFragment = graphql`
  fragment folderTree_folder on KnowledgeBaseItem @inline {
    id
    name
    parentId
  }
`;

/** Where an item can be put: a folder, or the root when `id` is null. */
export interface FolderTarget {
  id: string | null;
  name: string;
}

export const ROOT_FOLDER: FolderTarget = { id: null, name: 'Knowledge Base' };

export interface FolderTreeNode {
  id: string;
  name: string;
  children: FolderTreeNode[];
}

interface FlatFolder {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * The order the server lists folders in (oss-lib#2545: collation `en`, case
 * ignored, digits by value), so a picker reads like the listing next to it:
 * "apple" before "Zebra", "Folder 2" before "Folder 10".
 */
const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'accent' });

/** Nests a flat folder list. A folder whose parent is not in the list has nowhere to hang and is left out. */
export function buildFolderTree(folders: readonly FlatFolder[]): FolderTreeNode[] {
  const childrenOf = new Map<string | null, FlatFolder[]>();
  for (const folder of folders) {
    const siblings = childrenOf.get(folder.parentId);
    if (siblings) {
      siblings.push(folder);
    } else {
      childrenOf.set(folder.parentId, [folder]);
    }
  }

  const level = (parentId: string | null): FolderTreeNode[] =>
    [...(childrenOf.get(parentId) ?? [])]
      .sort((a, b) => byName.compare(a.name, b.name))
      .map(folder => ({ id: folder.id, name: folder.name, children: level(folder.id) }));

  return level(null);
}

/** The folder tree of a `knowledgeBaseFolderTree` answer. */
export function readFolderTree(folders: ReadonlyArray<folderTree_folder$key>): FolderTreeNode[] {
  return buildFolderTree(
    folders.map(folder => {
      const { id, name, parentId } = readInlineData(folderTreeFragment, folder);
      return { id, name, parentId: parentId ?? null };
    }),
  );
}

/** The name a picked folder goes by — null for an id the tree does not hold. */
export function findFolderName(tree: readonly FolderTreeNode[], id: string): string | null {
  for (const node of tree) {
    const name = node.id === id ? node.name : findFolderName(node.children, id);
    if (name !== null) {
      return name;
    }
  }
  return null;
}

/**
 * The folders as menu items: a leaf is picked on click, and a folder with
 * subfolders opens a submenu that offers the folder itself first. `excludeFolderId`
 * removes a folder together with everything under it — the one being moved or
 * deleted cannot be its own destination.
 */
export function folderMenuItems(
  tree: readonly FolderTreeNode[],
  onSelect: (target: FolderTarget) => void,
  excludeFolderId?: string | null,
): ActionsMenuItem[] {
  return tree
    .filter(node => node.id !== excludeFolderId)
    .map((node): ActionsMenuItem => {
      const pick = () => onSelect({ id: node.id, name: node.name });
      const children = folderMenuItems(node.children, onSelect, excludeFolderId);

      if (children.length === 0) {
        return { id: node.id, label: node.name, onClick: pick };
      }
      return {
        id: node.id,
        label: node.name,
        type: 'submenu',
        submenu: [
          { id: `${node.id}__self`, label: node.name, onClick: pick },
          { id: `${node.id}__sep`, label: '', type: 'separator' },
          ...children,
        ],
      };
    });
}
