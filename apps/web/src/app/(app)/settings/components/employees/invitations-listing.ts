import { ConnectionHandler, type RecordSourceProxy, ROOT_ID } from 'relay-runtime';

// The invitations block's `@connection` key, spelled a second time: the mutations
// that change the block reach its connection from outside the table.
const INVITATIONS_CONNECTION_KEY = 'invitationsListTable_invitations';

/** The block's connection for a search ('' is the unfiltered one), as the store keys it. */
export function invitationsListingId(search: string): string {
  return ConnectionHandler.getConnectionID(ROOT_ID, INVITATIONS_CONNECTION_KEY, { search: search || null });
}

/**
 * The listings a change reaches: the one on screen, and the unfiltered one a
 * cleared search goes back to — so clearing it never shows a stale block.
 */
export function affectedInvitationsListings(onScreenId: string): string[] {
  return [...new Set([onScreenId, invitationsListingId('')])];
}

/**
 * An invitation left the listings: each count goes down with the edge `@deleteEdge`
 * removed. Every listing passed contains it — the unfiltered one always, a searched
 * one because the row was on screen in it.
 */
export function decrementInvitationsCount(store: RecordSourceProxy, listingIds: readonly string[]): void {
  for (const listingId of new Set(listingIds)) {
    const listing = store.get(listingId);
    const count = listing?.getValue('filteredCount');
    if (listing && typeof count === 'number') {
      listing.setValue(Math.max(count - 1, 0), 'filteredCount');
    }
  }
}

/**
 * Invitations were added. Marked stale rather than handed edges: whether one
 * matches a search, and where it sorts, is the server's answer. A block showing
 * the listing refetches it; elsewhere the next visit loads it fresh.
 */
export function invalidateInvitationsListings(store: RecordSourceProxy, listingIds: readonly string[]): void {
  for (const listingId of new Set(listingIds)) {
    store.get(listingId)?.invalidateRecord();
  }
}
