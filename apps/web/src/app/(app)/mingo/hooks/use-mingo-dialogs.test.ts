import { describe, expect, it } from 'vitest';
import type { DialogNode } from '../types';
import {
  DIALOGS_BY_LAST_ACTIVITY,
  DIALOGS_FAST_POLL_MS,
  DIALOGS_POLL_MS,
  dialogsPollInterval,
  transformToDialogItem,
} from './use-mingo-dialogs';

function dialog(fields: Partial<DialogNode> = {}): DialogNode {
  return {
    id: 'RGlhbG9nOjZhYzRlM2EzZmI1MjNkNjIwOTQ3ZjIzOA',
    dialogId: '6ac4e3a3fb523d620947f238',
    title: 'User Guide Request',
    status: 'ACTIVE',
    streamState: 'IDLE',
    createdAt: '2026-10-06T12:03:47.516Z',
    ...fields,
  };
}

/**
 * The record of the open conversation is what tells the lib an archived chat
 * reached by link or reload is read-only - `archived` has to follow `status`.
 */
describe('transformToDialogItem', () => {
  it('marks an ARCHIVED dialog archived', () => {
    expect(transformToDialogItem(dialog({ status: 'ARCHIVED' }))).toMatchObject({
      id: '6ac4e3a3fb523d620947f238',
      title: 'User Guide Request',
      archived: true,
    });
  });

  it('keys the item by the raw dialogId, not the Relay global id', () => {
    expect(transformToDialogItem(dialog()).id).toBe('6ac4e3a3fb523d620947f238');
  });

  it('dates the row by its last message, by its creation while it has none', () => {
    const active = transformToDialogItem(dialog({ lastActivityAt: '2026-10-21T09:00:00Z' }));
    expect(active.timestamp).toEqual(new Date('2026-10-21T09:00:00Z'));
    expect(transformToDialogItem(dialog()).timestamp).toEqual(new Date('2026-10-06T12:03:47.516Z'));
  });

  it('leaves an active dialog writable', () => {
    expect(transformToDialogItem(dialog()).archived).toBe(false);
  });

  it('carries the admin owner for the header and the row avatar', () => {
    const item = transformToDialogItem(
      dialog({ owner: { type: 'ADMIN', userId: 'u-1', user: { id: 'u-1', firstName: 'Firsto', lastName: 'Lasto' } } }),
    );
    expect(item.owner).toMatchObject({ id: 'u-1', name: 'Firsto Lasto' });
  });
});

describe('transformToDialogItem: unread replies', () => {
  it('never hands the lib a count: the row status draws the new reply', () => {
    expect(transformToDialogItem(dialog({ unreadMessageCount: 3 })).unreadMessagesCount).toBe(0);
  });
});

describe('dialogsPollInterval', () => {
  const mine = { type: 'ADMIN', userId: 'u-1' } as const;
  const theirs = { type: 'ADMIN', userId: 'u-2' } as const;
  const page = (...dialogs: DialogNode[]) => [{ dialogs, pageInfo: { hasNextPage: false } }];

  it('is the slow poll while nothing in the list is about to change', () => {
    expect(dialogsPollInterval(page(dialog({ owner: mine })), 'u-1')).toBe(DIALOGS_POLL_MS);
    expect(dialogsPollInterval(undefined, 'u-1')).toBe(DIALOGS_POLL_MS);
  });

  it('is the fast poll while a chat of mine is answering', () => {
    const pages = page(dialog({ owner: mine }), dialog({ owner: mine, streamState: 'STREAMING' }));
    expect(dialogsPollInterval(pages, 'u-1')).toBe(DIALOGS_FAST_POLL_MS);
  });

  it('finds my answering chat on any loaded page', () => {
    const pages = [...page(dialog({ owner: mine })), ...page(dialog({ owner: mine, streamState: 'STREAMING' }))];
    expect(dialogsPollInterval(pages, 'u-1')).toBe(DIALOGS_FAST_POLL_MS);
  });

  it('stays slow for a chat someone else owns: its row never shows me a new reply', () => {
    expect(dialogsPollInterval(page(dialog({ owner: theirs, streamState: 'STREAMING' })), 'u-1')).toBe(DIALOGS_POLL_MS);
  });

  it('stays slow while the user is not known', () => {
    expect(dialogsPollInterval(page(dialog({ owner: mine, streamState: 'STREAMING' })), undefined)).toBe(
      DIALOGS_POLL_MS,
    );
    expect(dialogsPollInterval(page(dialog({ streamState: 'STREAMING' })), undefined)).toBe(DIALOGS_POLL_MS);
  });

  it('is still the fast poll while a title is being generated', () => {
    const fresh = dialog({ title: '', createdAt: new Date().toISOString() });
    expect(dialogsPollInterval(page(fresh), 'u-1')).toBe(DIALOGS_FAST_POLL_MS);
  });
});

describe('the chat list order', () => {
  it('is the latest message first', () => {
    expect(DIALOGS_BY_LAST_ACTIVITY).toEqual({ field: 'lastActivityAt', direction: 'DESC' });
  });
});
