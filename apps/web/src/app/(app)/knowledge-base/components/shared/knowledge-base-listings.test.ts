/**
 * Pins what the listing module still decides on the client:
 * - the `knowledgeBaseItems` arguments of a listing (the level, or its whole subtree under a search or a tag filter);
 * - the folder tree the pickers read, edited in place after a create or a delete (it is one unpaged list; the paged
 *   listings read their page again instead). Run against a real store holding a real answer of the picker's query, so
 *   a field name that drifted from the one the picker reads fails here instead of leaving the tree stale.
 */

import {
  createOperationDescriptor,
  Environment,
  Network,
  Observable,
  readInlineData,
  RecordSource,
  Store,
} from 'relay-runtime';
import { describe, expect, it } from 'vitest';
import folderPickerQuery from '@/__generated__/folderPickerQuery.graphql';
import folderTreeFragment, { type folderTree_folder$key } from '@/__generated__/folderTree_folder.graphql';
import { addToFolderTree, knowledgeBaseListingArgs, removeFromFolderTree } from './knowledge-base-listings';

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

/** A store with no server behind it: every answer here is committed by hand. */
function createEnvironment() {
  return new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
}

const folder = (id: string, parentId: string | null = null) => ({
  __typename: 'KnowledgeBaseItem',
  id,
  name: id,
  parentId,
});

/** Puts one answer of the picker's query into the store, the way a fetch would. */
function loadTree(environment: Environment, folders: ReturnType<typeof folder>[]) {
  const operation = createOperationDescriptor(folderPickerQuery, {});
  environment.retain(operation);
  environment.commitPayload(operation, { knowledgeBaseFolderTree: folders });
  return operation;
}

/** The folders the picker would offer, read the way it reads them. */
function treeIds(environment: Environment, operation: ReturnType<typeof loadTree>): string[] {
  const data = environment.lookup(operation.fragment).data as {
    knowledgeBaseFolderTree: readonly folderTree_folder$key[];
  };
  return data.knowledgeBaseFolderTree.map(ref => readInlineData(folderTreeFragment, ref).id);
}

describe('addToFolderTree', () => {
  it('adds a created folder to the tree the pickers read, once', () => {
    const environment = createEnvironment();
    const tree = loadTree(environment, [folder('guides'), folder('setup', 'guides')]);

    const create = () =>
      environment.commitUpdate(store => {
        const created = store.get('vpn') ?? store.create('vpn', 'KnowledgeBaseItem');
        created.setValue('vpn', 'id');
        created.setValue('vpn', 'name');
        created.setValue('guides', 'parentId');
        addToFolderTree(store, created);
      });
    create();
    create();

    expect(treeIds(environment, tree)).toEqual(['guides', 'setup', 'vpn']);
  });

  it('leaves a tree that is not in the store unread: the picker reads it whole when it opens', () => {
    const environment = createEnvironment();

    environment.commitUpdate(store => addToFolderTree(store, store.create('vpn', 'KnowledgeBaseItem')));

    const tree = createOperationDescriptor(folderPickerQuery, {});
    expect(environment.check(tree).status).toBe('missing');
  });
});

describe('removeFromFolderTree', () => {
  it('takes a deleted folder out of the tree the pickers read', () => {
    const environment = createEnvironment();
    const tree = loadTree(environment, [folder('guides'), folder('setup', 'guides')]);

    environment.commitUpdate(store => removeFromFolderTree(store, 'setup'));

    expect(treeIds(environment, tree)).toEqual(['guides']);
  });
});
