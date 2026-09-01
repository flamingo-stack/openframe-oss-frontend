import type { SlashCommandSummary } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it, vi } from 'vitest';
import { mapMingoMessageToUnified, needsAllChatsScope, sendMingoDisplayCommand } from './use-mingo-unified-chat-state';

const sources = [
  {
    index: 1,
    name: 'Installing the OpenFrame agent',
    path: 'docs/agent-installation.md',
    documentType: 'markdown',
    sourceRepo: 'openframe-docs',
  },
];

describe('mapMingoMessageToUnified', () => {
  it('retains sources on a live text message', () => {
    const message = mapMingoMessageToUnified({
      id: 'live-message',
      role: 'assistant',
      content: 'Install the agent from the Devices page.',
      name: 'Mingo',
      timestamp: new Date('2026-08-26T12:00:00Z'),
      sources,
    });

    expect(message.sources).toBe(sources);
  });

  it('retains sources on a segmented history message', () => {
    const message = mapMingoMessageToUnified({
      id: 'history-message',
      role: 'assistant',
      content: [{ type: 'guide', text: '## Install the agent' }],
      name: 'Mingo',
      timestamp: new Date('2026-08-26T11:00:00Z'),
      sources,
    });

    expect(message.sources).toBe(sources);
  });

  it('retains core-owned rich metadata without naming each field in the app mapper', () => {
    const refs = [{ type: 'video', id: 'MdFJNoJeqZQ', metadata: { youtubeUrl: 'https://youtu.be/MdFJNoJeqZQ' } }];
    const message = mapMingoMessageToUnified({
      id: 'rich-message',
      role: 'assistant',
      content: 'Watch [card://video:MdFJNoJeqZQ].',
      name: 'Mingo',
      timestamp: new Date('2026-08-26T13:00:00Z'),
      streamSeq: 42,
      scrollAnchor: 'top',
      refs,
    } as Parameters<typeof mapMingoMessageToUnified>[0] & { refs: typeof refs });

    expect(message).toMatchObject({ streamSeq: 42, scrollAnchor: 'top', refs });
  });
});

const displayCommands: SlashCommandSummary[] = [
  {
    id: 'product-docs',
    description: 'Search product documentation',
    primarySourceId: 'getting-started',
    actions: [{ id: 'display', label: 'Display' }],
  },
  {
    id: 'docs-display',
    description: 'Display product documentation',
    primarySourceId: 'openframe-docs',
    actions: [{ id: 'display', label: 'Display' }],
  },
  {
    id: 'search-only',
    description: 'Search documentation',
    primarySourceId: 'unsupported-docs',
    actions: [{ id: 'search', label: 'Search' }],
  },
];

describe('sendMingoDisplayCommand', () => {
  it('selects a display command by source repo and sends the escaped slug', () => {
    const sendMessage = vi.fn();

    expect(
      sendMingoDisplayCommand(
        {
          type: 'markdown',
          id: 'install-agent',
          title: 'Install the agent',
          url: null,
          sourceRepo: 'getting-started',
          metadata: { slug: 'agent\\"install' },
        },
        displayCommands,
        sendMessage,
      ),
    ).toBe(true);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith('/product-docs display "agent\\\\\\"install"');
  });

  it('falls back to the document-type table mapping when source repo has no display command', () => {
    const sendMessage = vi.fn();

    expect(
      sendMingoDisplayCommand(
        {
          type: 'markdown',
          id: 'guide-id',
          title: 'Getting Started',
          url: null,
          sourceRepo: 'missing-repo',
        },
        displayCommands,
        sendMessage,
      ),
    ).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith('/docs-display display "Getting Started"');
  });

  it('does not send when no matching command supports display', () => {
    const sendMessage = vi.fn();

    expect(
      sendMingoDisplayCommand(
        { type: 'unsupported', id: 'doc-id', title: 'Doc', url: null, sourceRepo: 'unsupported-docs' },
        displayCommands,
        sendMessage,
      ),
    ).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

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
