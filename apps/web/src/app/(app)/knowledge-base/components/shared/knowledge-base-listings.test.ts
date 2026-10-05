/**
 * Pins the one thing the listing store helpers cannot be seen to get wrong: they
 * find a listing by rebuilding its connection id, and an id that drifted from
 * the one Relay gives the table's connection makes every helper a silent no-op.
 * So this runs them against a real store holding a real answer of the table's
 * own query.
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
import archivedArticlesTableQuery from '@/__generated__/archivedArticlesTableQuery.graphql';
import knowledgeBaseItemsTableFragment, {
  type knowledgeBaseItemsTable_query$data,
} from '@/__generated__/knowledgeBaseItemsTable_query.graphql';
import knowledgeBaseItemsTableQuery, {
  type knowledgeBaseItemsTableQuery as KnowledgeBaseItemsTableQueryType,
} from '@/__generated__/knowledgeBaseItemsTableQuery.graphql';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import {
  invalidateArchiveListing,
  invalidateFolderListing,
  type KnowledgeBaseListing,
  knowledgeBaseListingArgs,
  removeFromFolderListing,
} from './knowledge-base-listings';

const PAGE_INFO = { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null };

function item(id: string, type: KnowledgeBaseItemType, parentId: string | null) {
  return {
    __typename: 'KnowledgeBaseItem',
    id,
    type,
    name: id,
    parentId,
    status: type === KnowledgeBaseItemType.ARTICLE ? 'PUBLISHED' : null,
    summary: null,
    createdAt: '2026-10-01T10:00:00Z',
  };
}

/** A store with no server behind it: every answer here is committed by hand. */
function createEnvironment() {
  return new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
}

/** The table's own variables for a listing — what `KnowledgeBaseItemsTable` sends. */
function tableVariables(listing: KnowledgeBaseListing): KnowledgeBaseItemsTableQueryType['variables'] {
  const { filter, search } = knowledgeBaseListingArgs(listing);
  return { filter, search, first: 20, after: null, folderFilter: filter, searching: false };
}

/** Puts one answer of the table's query into the store, the way a fetch would. */
function loadListing(environment: Environment, listing: KnowledgeBaseListing, items: ReturnType<typeof item>[]) {
  const operation = createOperationDescriptor(knowledgeBaseItemsTableQuery, tableVariables(listing));
  environment.retain(operation);
  environment.commitPayload(operation, {
    knowledgeBaseItems: {
      filteredCount: items.length,
      edges: items.map(node => ({ node, cursor: node.id })),
      pageInfo: PAGE_INFO,
    },
  });
  return operation;
}

/** The rows the table would draw for the listing — read the way its pagination fragment reads them. */
function listedIds(environment: Environment, operation: ReturnType<typeof loadListing>): string[] {
  const { filter, search, first, after } = operation.request.variables;
  const selector = createReaderSelector(
    knowledgeBaseItemsTableFragment,
    ROOT_ID,
    { filter, search, first, after },
    operation.request,
  );
  const data = environment.lookup(selector).data as knowledgeBaseItemsTable_query$data;
  return data.knowledgeBaseItems.edges.map(edge => edge.node.id);
}

const ROOT: KnowledgeBaseListing = { parentId: null, search: '', tagIds: [] };

describe('knowledgeBaseListingArgs', () => {
  it('asks for the whole level, both types, when nothing narrows it', () => {
    expect(knowledgeBaseListingArgs({ parentId: 'folder-1', search: '', tagIds: [] })).toEqual({
      filter: { parentId: 'folder-1', type: null, tagIds: null },
      search: null,
    });
  });

  it('passes the search and the tags through', () => {
    expect(knowledgeBaseListingArgs({ parentId: null, search: 'vpn', tagIds: ['t1'] })).toEqual({
      filter: { parentId: null, type: null, tagIds: ['t1'] },
      search: 'vpn',
    });
  });
});

describe('removeFromFolderListing', () => {
  it("takes the item out of its level's listing", () => {
    const environment = createEnvironment();
    const root = loadListing(environment, ROOT, [
      item('folder-1', KnowledgeBaseItemType.FOLDER, null),
      item('article-1', KnowledgeBaseItemType.ARTICLE, null),
    ]);

    environment.commitUpdate(store => removeFromFolderListing(store, null, 'article-1'));

    expect(listedIds(environment, root)).toEqual(['folder-1']);
  });

  it('leaves another level, and a search of the same level, alone', () => {
    const environment = createEnvironment();
    const inFolder = loadListing(environment, { ...ROOT, parentId: 'folder-1' }, [
      item('article-1', KnowledgeBaseItemType.ARTICLE, 'folder-1'),
    ]);
    const search = loadListing(environment, { ...ROOT, search: 'art' }, [
      item('article-1', KnowledgeBaseItemType.ARTICLE, 'folder-1'),
    ]);

    environment.commitUpdate(store => removeFromFolderListing(store, null, 'article-1'));

    expect(listedIds(environment, inFolder)).toEqual(['article-1']);
    expect(listedIds(environment, search)).toEqual(['article-1']);
  });
});

describe('invalidateFolderListing', () => {
  it("marks the level's listing stale, so its next read goes to the network", () => {
    const environment = createEnvironment();
    const root = loadListing(environment, ROOT, [item('folder-1', KnowledgeBaseItemType.FOLDER, null)]);
    const inFolder = loadListing(environment, { ...ROOT, parentId: 'folder-1' }, []);
    expect(environment.check(root).status).toBe('available');

    environment.commitUpdate(store => invalidateFolderListing(store, 'folder-1'));

    expect(environment.check(inFolder).status).toBe('stale');
    expect(environment.check(root).status).toBe('available');
  });
});

describe('invalidateArchiveListing', () => {
  it('marks the unfiltered archive stale', () => {
    const environment = createEnvironment();
    const archive = createOperationDescriptor(archivedArticlesTableQuery, {
      search: null,
      tagIds: null,
      first: 20,
      after: null,
    });
    environment.retain(archive);
    environment.commitPayload(archive, { archivedArticles: { filteredCount: 0, edges: [], pageInfo: PAGE_INFO } });
    expect(environment.check(archive).status).toBe('available');

    environment.commitUpdate(store => invalidateArchiveListing(store));

    expect(environment.check(archive).status).toBe('stale');
  });
});
