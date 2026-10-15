// Pins that a just-created dialog is listed at once: at the top of every cached
// chat list (MY and ALL), owned by the signed-in admin and titled by the list as
// "New Chat", but not in a list filtered by a search term, and never twice.

import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { DialogNode } from '../types';
import type { MingoDialogsPage } from './dialog-row-status';
import { insertNewDialog } from './insert-new-dialog';
import { mingoDialogQueryKeys } from './query-keys';

type DialogsData = InfiniteData<MingoDialogsPage, string | undefined>;

const existing = (dialogId: string): DialogNode => ({
  id: `g-${dialogId}`,
  dialogId,
  title: dialogId,
  status: 'ACTIVE',
  streamState: 'IDLE',
  createdAt: '2026-10-01T00:00:00Z',
});

const page = (...dialogIds: string[]): DialogsData => ({
  pages: [{ dialogs: dialogIds.map(existing), pageInfo: { hasNextPage: false } }],
  pageParams: [undefined],
});

const key = (params: { search?: string; scope: string }) =>
  mingoDialogQueryKeys.list({ limit: 20, withPendingApproval: true, ...params });

const ids = (client: QueryClient, params: { search?: string; scope: string }) =>
  client.getQueryData<DialogsData>(key(params))?.pages.flatMap(p => p.dialogs.map(d => d.dialogId));

const OWNER = { id: 'u-1', firstName: 'Ann', lastName: 'Lee', image: null };

describe('insertNewDialog', () => {
  it('puts the new dialog first in every cached list, owned by the admin', () => {
    const client = new QueryClient();
    client.setQueryData(key({ scope: 'my' }), page('a', 'b'));
    client.setQueryData(key({ scope: 'all' }), page('c'));

    insertNewDialog(client, 'new', OWNER);

    expect(ids(client, { scope: 'my' })).toEqual(['new', 'a', 'b']);
    expect(ids(client, { scope: 'all' })).toEqual(['new', 'c']);
    const node = client.getQueryData<DialogsData>(key({ scope: 'my' }))?.pages[0].dialogs[0];
    expect(node).toMatchObject({ dialogId: 'new', title: '', status: 'ACTIVE', owner: { userId: 'u-1' } });
  });

  it('leaves a searched list and a list that already holds the dialog alone', () => {
    const client = new QueryClient();
    client.setQueryData(key({ scope: 'all', search: 'printer' }), page('a'));
    client.setQueryData(key({ scope: 'my' }), page('new', 'a'));

    insertNewDialog(client, 'new', OWNER);

    expect(ids(client, { scope: 'all', search: 'printer' })).toEqual(['a']);
    expect(ids(client, { scope: 'my' })).toEqual(['new', 'a']);
  });
});
