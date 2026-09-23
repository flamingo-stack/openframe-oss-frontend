import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { TicketsPage } from '../services/ticket-service.types';
import type { Dialog } from '../types/dialog.types';
import { clearCachedUnreadMessages, lastClientMessageId } from './client-chat-read';
import { dialogsQueryKeys } from './query-keys';

const row = (id: string, authorType?: 'user' | 'admin' | 'fae') => ({ id, authorType });

describe('lastClientMessageId', () => {
  it('is null with no rows or no end-user rows', () => {
    expect(lastClientMessageId([])).toBeNull();
    expect(lastClientMessageId([row('a1', 'fae'), row('t1', 'admin'), row('o1')])).toBeNull();
  });

  it('returns the newest end-user row, ignoring later technician and assistant rows', () => {
    const rows = [row('u1', 'user'), row('a1', 'fae'), row('u2', 'user'), row('t1', 'admin'), row('a2', 'fae')];
    expect(lastClientMessageId(rows)).toBe('u2');
  });
});

function ticket(id: string, unreadMessageCount: number): Dialog {
  return { id, title: id, owner: { type: 'ADMIN' }, createdAt: '2026-09-23T00:00:00Z', unreadMessageCount };
}

function pages(...dialogs: Dialog[]): InfiniteData<TicketsPage> {
  return {
    pageParams: [undefined],
    pages: [{ dialogs, pageInfo: { hasNextPage: false, hasPreviousPage: false }, filteredCount: dialogs.length }],
  };
}

describe('clearCachedUnreadMessages', () => {
  it('zeroes the ticket in every cached list and board column, leaving other tickets alone', () => {
    const queryClient = new QueryClient();
    const listKey = dialogsQueryKeys.list({ archived: false });
    const columnKey = dialogsQueryKeys.boardColumn('status-1', {});
    queryClient.setQueryData(listKey, pages(ticket('t-1', 3), ticket('t-2', 2)));
    queryClient.setQueryData(columnKey, pages(ticket('t-1', 1)));

    clearCachedUnreadMessages(queryClient, 't-1');

    expect(queryClient.getQueryData<InfiniteData<TicketsPage>>(listKey)?.pages[0].dialogs).toEqual([
      ticket('t-1', 0),
      ticket('t-2', 2),
    ]);
    expect(queryClient.getQueryData<InfiniteData<TicketsPage>>(columnKey)?.pages[0].dialogs).toEqual([
      ticket('t-1', 0),
    ]);
  });

  it('keeps the cache reference when the ticket is absent or already read', () => {
    const queryClient = new QueryClient();
    const listKey = dialogsQueryKeys.list({ archived: false });
    const before = pages(ticket('t-1', 0), ticket('t-2', 2));
    queryClient.setQueryData(listKey, before);

    clearCachedUnreadMessages(queryClient, 't-1');
    clearCachedUnreadMessages(queryClient, 't-9');

    expect(queryClient.getQueryData(listKey)).toBe(before);
  });
});
