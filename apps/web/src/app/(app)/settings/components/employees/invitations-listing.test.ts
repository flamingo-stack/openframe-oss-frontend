/**
 * Pins what the invitations helpers cannot be seen to get wrong: they find a
 * listing by rebuilding its connection id, and an id that drifted from the one
 * Relay gives the block's connection (the key is spelled twice) makes every helper
 * a silent no-op. So this runs them against a real store holding a real answer of
 * the block's own query.
 */

import {
  createOperationDescriptor,
  createReaderSelector,
  Environment,
  Network,
  Observable,
  RecordSource,
  ROOT_ID,
  Store,
} from 'relay-runtime';
import { describe, expect, it } from 'vitest';
import invitationsListTableFragment, {
  type invitationsListTable_query$data,
} from '@/__generated__/invitationsListTable_query.graphql';
import invitationsListTableQuery, {
  type InvitationFilterInput,
} from '@/__generated__/invitationsListTableQuery.graphql';
import { InvitationStatus, UserRole } from '@/generated/schema-enums';
import {
  affectedInvitationsListings,
  decrementInvitationsCount,
  invalidateInvitationsListings,
  invitationsListingId,
} from './invitations-listing';

const PAGE_INFO = { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null };

function invitation(id: string) {
  return {
    __typename: 'Invitation',
    id,
    email: `${id}@acme.io`,
    roles: [UserRole.ADMIN],
    status: InvitationStatus.PENDING,
  };
}

/** A store with no server behind it: every answer here is committed by hand. */
function createEnvironment() {
  return new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
}

/** Puts one answer of the table's query into the store, the way a fetch would. */
function loadListing(
  environment: Environment,
  search: string,
  ids: string[],
  filter: InvitationFilterInput | null = null,
) {
  const operation = createOperationDescriptor(invitationsListTableQuery, { filter, search: search || null, first: 20 });
  environment.retain(operation);
  environment.commitPayload(operation, {
    invitations: {
      filteredCount: ids.length,
      edges: ids.map(id => ({ node: invitation(id), cursor: id })),
      pageInfo: PAGE_INFO,
    },
  });
  return operation;
}

/** The listing as the table reads it, through its pagination fragment. */
function readListing(environment: Environment, operation: ReturnType<typeof loadListing>) {
  const { filter, search, first } = operation.request.variables;
  const selector = createReaderSelector(
    invitationsListTableFragment,
    ROOT_ID,
    { filter, search, first, after: null },
    operation.request,
  );
  return (environment.lookup(selector).data as invitationsListTable_query$data).invitations;
}

describe('invitationsListingId', () => {
  it("is the id Relay gives the table's connection, unfiltered, searched and narrowed", () => {
    const environment = createEnvironment();
    const filter: InvitationFilterInput = { statuses: [InvitationStatus.EXPIRED], roles: [UserRole.ADMIN] };
    const unfiltered = loadListing(environment, '', ['inv-1']);
    const searched = loadListing(environment, 'acme', ['inv-1']);
    const narrowed = loadListing(environment, 'acme', ['inv-1'], filter);

    expect(readListing(environment, unfiltered).__id).toBe(invitationsListingId(''));
    expect(readListing(environment, searched).__id).toBe(invitationsListingId('acme'));
    expect(readListing(environment, narrowed).__id).toBe(invitationsListingId('acme', filter));
    expect(invitationsListingId('acme', filter)).not.toBe(invitationsListingId('acme'));
  });
});

describe('affectedInvitationsListings', () => {
  it('is the listing on screen and the unfiltered one, once each', () => {
    expect(affectedInvitationsListings(invitationsListingId('acme'))).toEqual([
      invitationsListingId('acme'),
      invitationsListingId(''),
    ]);
    expect(affectedInvitationsListings(invitationsListingId(''))).toEqual([invitationsListingId('')]);
  });
});

describe('decrementInvitationsCount', () => {
  it('counts one fewer in every listing passed', () => {
    const environment = createEnvironment();
    const unfiltered = loadListing(environment, '', ['inv-1', 'inv-2']);
    const searched = loadListing(environment, 'inv-1', ['inv-1']);

    environment.commitUpdate(store =>
      decrementInvitationsCount(store, affectedInvitationsListings(invitationsListingId('inv-1'))),
    );

    expect(readListing(environment, unfiltered).filteredCount).toBe(1);
    expect(readListing(environment, searched).filteredCount).toBe(0);
  });
});

describe('invalidateInvitationsListings', () => {
  it('marks the listings passed stale and leaves the others', () => {
    const environment = createEnvironment();
    loadListing(environment, '', ['inv-1']);
    loadListing(environment, 'other', ['inv-1']);
    const store = environment.getStore();
    const unfiltered = store.lookupInvalidationState([invitationsListingId('')]);
    const other = store.lookupInvalidationState([invitationsListingId('other')]);

    environment.commitUpdate(proxy => invalidateInvitationsListings(proxy, [invitationsListingId('')]));

    expect(store.checkInvalidationState(unfiltered)).toBe(true);
    expect(store.checkInvalidationState(other)).toBe(false);
  });
});
