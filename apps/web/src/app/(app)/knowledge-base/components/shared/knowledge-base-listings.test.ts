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
  moveBetweenFolders,
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
    parent: null,
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
  return { ...knowledgeBaseListingArgs(listing), first: 20, after: null };
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

/** The listing as the table reads it, through its pagination fragment. */
function readListing(environment: Environment, operation: ReturnType<typeof loadListing>) {
  const { filter, search, first, after } = operation.request.variables;
  const selector = createReaderSelector(
    knowledgeBaseItemsTableFragment,
    ROOT_ID,
    { filter, search, first, after },
    operation.request,
  );
  return (environment.lookup(selector).data as knowledgeBaseItemsTable_query$data).knowledgeBaseItems;
}

/** The rows the table would draw for the listing. */
function listedIds(environment: Environment, operation: ReturnType<typeof loadListing>): string[] {
  return readListing(environment, operation).edges.map(edge => edge.node.id);
}

const ROOT: KnowledgeBaseListing = { parentId: null, search: '', tagIds: [] };

describe('knowledgeBaseListingArgs', () => {
  it('asks for the level itself, both types, when nothing narrows it', () => {
    expect(knowledgeBaseListingArgs({ parentId: 'folder-1', search: '', tagIds: [] })).toEqual({
      filter: { parentId: 'folder-1', type: null, tagIds: null, scope: 'CHILDREN' },
      search: null,
    });
  });

  it('asks for the whole subtree under a search', () => {
    expect(knowledgeBaseListingArgs({ parentId: 'folder-1', search: 'vpn', tagIds: [] })).toEqual({
      filter: { parentId: 'folder-1', type: null, tagIds: null, scope: 'DESCENDANTS' },
      search: 'vpn',
    });
  });

  it('asks for the whole subtree under a tag filter', () => {
    expect(knowledgeBaseListingArgs({ parentId: null, search: '', tagIds: ['t1'] })).toEqual({
      filter: { parentId: null, type: null, tagIds: ['t1'], scope: 'DESCENDANTS' },
      search: null,
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

describe('moveBetweenFolders', () => {
  it('takes the item out of the level it left and marks the one it joined stale', () => {
    const environment = createEnvironment();
    const root = loadListing(environment, ROOT, [item('article-1', KnowledgeBaseItemType.ARTICLE, null)]);
    const inFolder = loadListing(environment, { ...ROOT, parentId: 'folder-1' }, []);

    environment.commitUpdate(store => moveBetweenFolders(store, { itemId: 'article-1', from: null, to: 'folder-1' }));

    expect(listedIds(environment, root)).toEqual([]);
    expect(environment.check(root).status).toBe('available');
    expect(environment.check(inFolder).status).toBe('stale');
  });

  it('marks a search on screen stale instead of deciding whether the item is still under it', () => {
    const environment = createEnvironment();
    const search = loadListing(environment, { ...ROOT, parentId: 'folder-1', search: 'art' }, [
      item('article-1', KnowledgeBaseItemType.ARTICLE, 'folder-2'),
    ]);
    // What the table hands the row dialogs: the id of the listing it draws.
    const onScreen = [readListing(environment, search).__id];

    environment.commitUpdate(store =>
      moveBetweenFolders(store, { itemId: 'article-1', from: 'folder-2', to: null, onScreen }),
    );

    expect(listedIds(environment, search)).toEqual(['article-1']);
    expect(environment.check(search).status).toBe('stale');
  });

  it('does nothing when the folder is the same', () => {
    const environment = createEnvironment();
    const root = loadListing(environment, ROOT, [item('article-1', KnowledgeBaseItemType.ARTICLE, null)]);

    environment.commitUpdate(store => moveBetweenFolders(store, { itemId: 'article-1', from: null, to: null }));

    expect(listedIds(environment, root)).toEqual(['article-1']);
    expect(environment.check(root).status).toBe('available');
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
