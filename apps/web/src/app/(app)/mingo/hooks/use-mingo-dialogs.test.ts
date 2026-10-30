import { describe, expect, it } from 'vitest';
import type { DialogNode } from '../types';
import { DIALOGS_BY_LAST_ACTIVITY, transformToDialogItem } from './use-mingo-dialogs';

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

describe('the chat list order', () => {
  it('is the latest message first', () => {
    expect(DIALOGS_BY_LAST_ACTIVITY).toEqual({ field: 'lastActivityAt', direction: 'DESC' });
  });
});
