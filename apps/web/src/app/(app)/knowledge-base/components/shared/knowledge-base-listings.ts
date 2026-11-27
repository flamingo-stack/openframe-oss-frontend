import type { RecordProxy, RecordSourceProxy } from 'relay-runtime';
import type { KnowledgeBaseFilterInput } from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';
import { KnowledgeBaseScope } from '@/generated/schema-enums';

/** The folder tree's root field, as the folder picker selects it. */
const FOLDER_TREE_FIELD = 'knowledgeBaseFolderTree';

/** One listing of the knowledge base: a level, and what narrows it. */
export interface KnowledgeBaseListing {
  /** The folder listed; null is the root. */
  parentId: string | null;
  search: string;
  tagIds: readonly string[];
}

/**
 * A search or a tag filter reaches below the level: it lists everything under
 * it, at any depth, so its rows come from different folders.
 */
export function isSubtreeListing({ search, tagIds }: Pick<KnowledgeBaseListing, 'search' | 'tagIds'>): boolean {
  return search !== '' || tagIds.length > 0;
}

/**
 * The `knowledgeBaseItems` arguments of a listing, beside the page: what the table sends. `type: null` is folders
 * and articles as one list, folders first. The scope is always named: the level's own items while browsing, its whole
 * subtree under a search or a tag filter.
 */
export function knowledgeBaseListingArgs(listing: KnowledgeBaseListing) {
  const { parentId, search, tagIds } = listing;
  const filter: KnowledgeBaseFilterInput = {
    parentId,
    type: null,
    tagIds: tagIds.length > 0 ? [...tagIds] : null,
    scope: isSubtreeListing(listing) ? KnowledgeBaseScope.DESCENDANTS : KnowledgeBaseScope.CHILDREN,
  };
  return { filter, search: search || null };
}

/**
 * A new folder joins the tree the folder pickers read, when the tree is in the store at all. The tree is one unpaged
 * list, so it is edited in place; the paged listings read their page again instead (`markListChanged`).
 */
export function addToFolderTree(store: RecordSourceProxy, folder: RecordProxy): void {
  const root = store.getRoot();
  const folders = root.getLinkedRecords(FOLDER_TREE_FIELD);
  if (!folders || folders.some(known => known.getDataID() === folder.getDataID())) {
    return;
  }
  root.setLinkedRecords([...folders, folder], FOLDER_TREE_FIELD);
}

/** A deleted folder leaves the tree the folder pickers read. */
export function removeFromFolderTree(store: RecordSourceProxy, folderId: string): void {
  const root = store.getRoot();
  const folders = root.getLinkedRecords(FOLDER_TREE_FIELD);
  if (folders) {
    root.setLinkedRecords(
      folders.filter(known => known.getDataID() !== folderId),
      FOLDER_TREE_FIELD,
    );
  }
}
