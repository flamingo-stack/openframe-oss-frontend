import type { ChatRef, SlashCommandSummary } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it } from 'vitest';
import type { ProcessedMessage } from './use-mingo-chat';
import {
  buildMingoDisplayCommand,
  hasMingoDisplayCommand,
  mapMingoMessageToUnified,
  needsAllChatsScope,
} from './use-mingo-unified-chat-state';

const TIMESTAMP = new Date('2026-08-26T12:00:00Z');

function assistantMessage(fields: Record<string, unknown> = {}): ProcessedMessage {
  return {
    id: 'assistant-turn',
    role: 'assistant',
    content: 'Install the agent from the Devices page.',
    name: 'Mingo',
    timestamp: TIMESTAMP,
    ...fields,
  } as ProcessedMessage;
}

/**
 * The seam between the reducer's rows and what the lib renders. Its whole job is
 * to be exhaustive WITHOUT enumerating: the lib keeps adding per-message metadata
 * (Guide Mode V3's `sources` / card refs being the current batch), and a mapper
 * that lists fields drops every one it was not updated for — silently, because
 * the message still renders, just without the part the new field carried.
 */
describe('mapMingoMessageToUnified', () => {
  it('forwards metadata the mapper never names', () => {
    // `sources` / `refs` are Guide Mode V3's per-answer metadata. The mapper
    // does not mention them by name — that is the point: they ride through
    // because it spreads what it did not destructure.
    const sources = [{ index: 1, name: 'Install the agent', path: 'docs/agent.md', documentType: 'markdown' }];
    const refs = [{ type: 'video', id: 'MdFJNoJeqZQ', title: 'Install', url: null }];
    const message = mapMingoMessageToUnified(
      assistantMessage({ streamSeq: 42, scrollAnchor: 'top', hidden: true, sources, refs }),
    );

    expect(message).toMatchObject({ id: 'assistant-turn', streamSeq: 42, scrollAnchor: 'top', hidden: true });
    // By reference — the lib's message memo compares this way.
    expect(message.sources).toBe(sources);
    expect(message.refs).toBe(refs);
  });

  it('moves a segment list into `segments` and empties `content`', () => {
    const segments = [{ type: 'text' as const, text: '## Install the agent' }];
    const message = mapMingoMessageToUnified(assistantMessage({ content: segments }));

    expect(message.segments).toBe(segments);
    expect(message.content).toBe('');
  });

  it('drops the host identity on assistant rows so the lib renders its own', () => {
    const message = mapMingoMessageToUnified(assistantMessage({ avatar: '/mingo.png', authorType: 'admin' }));

    expect(message.name).toBeUndefined();
    expect(message.avatar).toBeUndefined();
    expect(message.authorType).toBeUndefined();
  });

  it('carries the real sender identity and context chips on user rows', () => {
    const contextItems = [{ type: 'DEVICE', id: 'device-42' }];
    const message = mapMingoMessageToUnified(
      assistantMessage({
        role: 'user',
        name: 'Ada Lovelace',
        avatar: 'https://cdn.example/ada.png',
        authorType: 'admin',
        contextItems,
      }),
    );

    expect(message).toMatchObject({
      role: 'user',
      name: 'Ada Lovelace',
      avatar: 'https://cdn.example/ada.png',
      authorType: 'admin',
      contextItems,
    });
  });

  it('degrades an unresolved sender name to the lib fallback', () => {
    expect(mapMingoMessageToUnified(assistantMessage({ role: 'user', name: 'Unknown' })).name).toBeUndefined();
  });

  it('folds an error row into the assistant bubble', () => {
    expect(mapMingoMessageToUnified(assistantMessage({ role: 'error' })).role).toBe('assistant');
  });
});

const displayCommands: SlashCommandSummary[] = [
  {
    id: 'onboarding-guides',
    description: 'Onboarding guides',
    primarySourceId: 'onboarding-guides',
    actions: [{ id: 'display', label: 'Display' }],
  },
  {
    id: 'openframe-docs',
    description: 'Product documentation',
    primarySourceId: 'openframe-docs',
    actions: [{ id: 'display', label: 'Display' }],
  },
  {
    id: 'search-only',
    description: 'Webinars',
    primarySourceId: 'webinars',
    actions: [{ id: 'search', label: 'Search' }],
  },
];

function ref(fields: Partial<ChatRef> & Pick<ChatRef, 'type' | 'id' | 'title'>): ChatRef {
  return { url: null, ...fields };
}

describe('buildMingoDisplayCommand', () => {
  it('resolves the command from the ref’s own sourceRepo', () => {
    // V3 hands the registry table id back with the card, so nothing is guessed.
    expect(
      buildMingoDisplayCommand(
        ref({
          type: 'onboarding_guide',
          id: '88dd40cc',
          title: 'Install the OpenFrame Agent on Windows',
          sourceRepo: 'onboarding-guides',
          metadata: { slug: 'install-the-openframe-agent-on-windows' },
        }),
        displayCommands,
      ),
    ).toBe('/onboarding-guides display "install-the-openframe-agent-on-windows"');
  });

  it('falls back to the documentType→table map for a ref with no sourceRepo', () => {
    expect(
      buildMingoDisplayCommand(ref({ type: 'markdown', id: 'guide-id', title: 'Getting Started' }), displayCommands),
    ).toBe('/openframe-docs display "Getting Started"');
  });

  it('escapes a value that would otherwise break out of the quotes', () => {
    // `\` before `"`, so a trailing backslash cannot smuggle the close quote
    // past a parser that honours JS-style escapes.
    expect(
      buildMingoDisplayCommand(
        ref({ type: 'markdown', id: 'doc', title: 'x', metadata: { slug: 'a\\b"c' } }),
        displayCommands,
      ),
    ).toBe('/openframe-docs display "a\\\\b\\"c"');
  });

  it('returns null when the resolved source has no display command', () => {
    // `search-only` covers the same source but would run a query instead of
    // dumping the row — offering Display for it would be a lie.
    expect(buildMingoDisplayCommand(ref({ type: 'webinar', id: 'w-1', title: 'Pricing' }), displayCommands)).toBeNull();
  });

  it('returns null for a document type the catalog does not cover', () => {
    expect(buildMingoDisplayCommand(ref({ type: 'unknown_type', id: 'x', title: 'X' }), displayCommands)).toBeNull();
  });
});

describe('hasMingoDisplayCommand', () => {
  it('is true when the catalog can display something', () => {
    expect(hasMingoDisplayCommand(displayCommands)).toBe(true);
  });

  it('is false for the V2 catalog, where the affordance must not render at all', () => {
    expect(hasMingoDisplayCommand([displayCommands[2]])).toBe(false);
    expect(hasMingoDisplayCommand([])).toBe(false);
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
