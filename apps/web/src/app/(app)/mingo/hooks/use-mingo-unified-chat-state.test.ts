import type { ChatRef, SlashCommandSummary } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { afterEach, describe, expect, it } from 'vitest';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { useMingoContextStore } from '../stores/mingo-context-store';
import { buildMingoDisplayCommand, hasMingoDisplayCommand, snapshotSendContext } from './use-mingo-unified-chat-state';

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
describe('snapshotSendContext', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    useMingoContextStore.setState({ openView: null, recentViews: [] });
    useMingoSheetStore.setState({ lastPage: null });
  });

  it('carries the page on screen and the filters in its URL', () => {
    window.history.replaceState(null, '', '/devices/?statuses=OFFLINE');

    expect(snapshotSendContext()).toMatchObject({
      currentPage: { kind: 'LIST', title: 'Devices' },
      currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
    });
  });

  it('carries the page a chat page was opened from', () => {
    window.history.replaceState(null, '', '/mingo/chat/?id=d-1');
    useMingoSheetStore.setState({ lastPage: '/settings/?tab=api-keys' });

    expect(snapshotSendContext().currentPage).toEqual({ kind: 'SETTINGS', title: 'Settings', section: 'api-keys' });
  });

  it("on a phone, carries from Mingo's home the page the chat list was opened over", () => {
    const matchMedia = window.matchMedia;
    // Narrower than md: no query matches.
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as typeof window.matchMedia;
    try {
      window.history.replaceState(null, '', '/mingo/');
      useMingoSheetStore.setState({ lastPage: '/devices/', newChatPage: '/devices/?statuses=OFFLINE' });
      expect(snapshotSendContext()).toMatchObject({
        currentPage: { kind: 'LIST', title: 'Devices' },
        currentList: { module: 'DEVICES', filters: [{ field: 'statuses', values: ['OFFLINE'] }] },
      });
    } finally {
      window.matchMedia = matchMedia;
      useMingoSheetStore.setState({ newChatPage: null });
    }
  });

  it("names an entity's page after the open view and carries the picker's selection", () => {
    window.history.replaceState(null, '', '/devices/details/?id=m-1');
    useMingoContextStore.setState({ openView: { type: 'DEVICE', id: 'm-1', label: 'MacBook' } });

    expect(snapshotSendContext({ contextItems: [{ type: 'SCRIPT', id: 's-1', label: 'Cleanup' }] })).toMatchObject({
      currentPage: { kind: 'ENTITY', title: 'Device: MacBook' },
      openView: { type: 'DEVICE', id: 'm-1' },
      contextItems: [{ type: 'SCRIPT', id: 's-1', label: 'Cleanup' }],
    });
  });
});
