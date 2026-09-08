import { describe, expect, it } from 'vitest';
import { needsAllChatsScope } from './use-mingo-unified-chat-state';

/**
 * The rail's scope is a filter over the LIST, but a dialog can arrive without going
 * through the list — a shared link or a notification tap. These pin the one direction
 * the reconciliation is allowed to move in, and the two cases that must NOT move it.
 */
describe('needsAllChatsScope', () => {
  it('switches when the open conversation belongs to someone else', () => {
    // QA's two reports are both this: a link copied from All Chats, and user A's link
    // opened by user B. Neither dialog can appear under the opener's "My Chats".
    expect(needsAllChatsScope('user-b', 'user-a')).toBe(true);
  });

  it('leaves the scope alone for the viewer’s own conversation', () => {
    // Already listed under "My Chats" — moving them to All Chats would be a worse
    // view than the one they chose.
    expect(needsAllChatsScope('user-a', 'user-a')).toBe(false);
  });

  it('leaves the scope alone for a client dialog, which neither admin scope lists', () => {
    // Machine-owned (Fae) dialogs carry no `userId`; switching tabs would not reveal them.
    expect(needsAllChatsScope(undefined, 'user-a')).toBe(false);
  });

  it('leaves the scope alone before the viewer is known', () => {
    // Guarding this is what stops every dialog looking like someone else's during the
    // window before `/me` answers.
    expect(needsAllChatsScope('user-b', undefined)).toBe(false);
  });
});
