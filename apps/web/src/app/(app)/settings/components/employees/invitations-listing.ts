import { ConnectionHandler, type RecordSourceProxy, ROOT_ID } from 'relay-runtime';
import type { InvitationFilterInput } from '@/__generated__/invitationsListTableQuery.graphql';

// The invitations table's `@connection` key, spelled a second time: the mutations
// that change the table reach its connection from outside it.
const INVITATIONS_CONNECTION_KEY = 'invitationsListTable_invitations';

/**
 * The table's connection for a search and funnels ('' and null: the unfiltered
 * one), as the store keys it.
 */
export function invitationsListingId(search: string, filter: InvitationFilterInput | null = null): string {
  return ConnectionHandler.getConnectionID(ROOT_ID, INVITATIONS_CONNECTION_KEY, { filter, search: search || null });
}

/**
 * The listings a change reaches: the one on screen, and the unfiltered one a
 * cleared search and funnels go back to — so clearing them never shows a stale
 * table.
 */
export function affectedInvitationsListings(onScreenId: string): string[] {
  return [...new Set([onScreenId, invitationsListingId('')])];
}

/**
 * An invitation left the listings: each count goes down with the edge `@deleteEdge`
 * removed. Every record passed counts it — the unfiltered listing always, a
 * narrowed one because the row was on screen in it, and the tab bar's count of
 * the search on screen. Anything with a `filteredCount` qualifies.
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
 * matches a search, and where it sorts, is the server's answer. Whatever shows
 * a record passed (the table, the tab bar's count) refetches it; elsewhere the
 * next visit loads it fresh.
 */
export function invalidateInvitationsListings(store: RecordSourceProxy, listingIds: readonly string[]): void {
  for (const listingId of new Set(listingIds)) {
    store.get(listingId)?.invalidateRecord();
  }
}
