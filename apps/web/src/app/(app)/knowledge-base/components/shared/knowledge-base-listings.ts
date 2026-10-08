import { ConnectionHandler, type RecordProxy, type RecordSourceProxy, ROOT_ID } from 'relay-runtime';
import type { KnowledgeBaseFilterInput } from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';
import { KnowledgeBaseScope } from '@/generated/schema-enums';

// The tables' `@connection` keys, spelled a second time: the test runs these helpers against the
// tables' own queries, so a drift fails there instead of turning every helper into a no-op.
const KNOWLEDGE_BASE_ITEMS_CONNECTION_KEY = 'knowledgeBaseItemsTable_knowledgeBaseItems';
const ARCHIVED_ARTICLES_CONNECTION_KEY = 'archivedArticlesTable_archivedArticles';

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
 * The `knowledgeBaseItems` arguments of a listing — what the table sends, and so
 * what its connection in the store is keyed by. `type: null` is folders and
 * articles as one list, folders first. The scope is always named: the level's
 * own items while browsing, its whole subtree under a search or a tag filter.
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

/** A level as it is listed with nothing narrowing it — the listing an item enters or leaves. */
function folderListingId(parentId: string | null): string {
  return ConnectionHandler.getConnectionID(
    ROOT_ID,
    KNOWLEDGE_BASE_ITEMS_CONNECTION_KEY,
    knowledgeBaseListingArgs({ parentId, search: '', tagIds: [] }),
  );
}

/** Drops an item's row from the listings it no longer belongs to; one that is not in the store is skipped. */
export function removeFromListings(store: RecordSourceProxy, listingIds: readonly string[], itemId: string): void {
  for (const listingId of new Set(listingIds)) {
    const listing = store.get(listingId);
    if (listing) {
      ConnectionHandler.deleteNode(listing, itemId);
    }
  }
}

/** The item left this level — whichever page it was archived or deleted from. */
export function removeFromFolderListing(store: RecordSourceProxy, parentId: string | null, itemId: string): void {
  removeFromListings(store, [folderListingId(parentId)], itemId);
}

/**
 * The level gained an item. Marked stale rather than handed an edge: where the
 * row belongs is the server's order, across pages the store may not hold. A table
 * showing the listing refetches it; elsewhere the next visit loads it fresh.
 */
export function invalidateFolderListing(store: RecordSourceProxy, parentId: string | null): void {
  store.get(folderListingId(parentId))?.invalidateRecord();
}

interface FolderMove {
  itemId: string;
  from: string | null;
  to: string | null;
  /** The listings on screen that draw the item, when it is moved from a list. */
  onScreen?: readonly string[];
}

/**
 * The item moved to another folder. The level it left loses the row and the one
 * it joined is marked stale. Any other listing on screen is a subtree (a search,
 * a tag filter): whether the item is still under it is the server's to say, so
 * that one is marked stale as well.
 */
export function moveBetweenFolders(store: RecordSourceProxy, { itemId, from, to, onScreen = [] }: FolderMove): void {
  if (from === to) return;
  const left = folderListingId(from);
  removeFromListings(store, [left], itemId);
  for (const listingId of new Set([folderListingId(to), ...onScreen])) {
    if (listingId !== left) {
      store.get(listingId)?.invalidateRecord();
    }
  }
}

/** The archive gained or lost an article from another page — same reasoning as above. */
export function invalidateArchiveListing(store: RecordSourceProxy): void {
  store.get(ConnectionHandler.getConnectionID(ROOT_ID, ARCHIVED_ARTICLES_CONNECTION_KEY))?.invalidateRecord();
}

/** A new folder joins the tree the folder pickers read, when the tree is in the store at all. */
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
