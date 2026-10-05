import { ConnectionHandler, type RecordProxy, type RecordSourceProxy, ROOT_ID } from 'relay-runtime';
import type { KnowledgeBaseFilterInput } from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';

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
 * The `knowledgeBaseItems` arguments of a listing — what the table sends, and so
 * what its connection in the store is keyed by. `type: null` is the level as one
 * list, folders first.
 *
 * TODO(oss-lib#2545): send `scope` — CHILDREN while browsing, DESCENDANTS under a
 * search or a tag filter. Until then the server picks the depth itself, and a
 * search or a tag filter lists the subtree's articles without the folders.
 */
export function knowledgeBaseListingArgs({ parentId, search, tagIds }: KnowledgeBaseListing) {
  const filter: KnowledgeBaseFilterInput = { parentId, type: null, tagIds: tagIds.length > 0 ? [...tagIds] : null };
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

/** The item left this level — whichever page it was moved, archived or deleted from. */
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
