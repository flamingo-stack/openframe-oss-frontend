/**
 * The ASK intro alias.
 *
 * `AskData.text` is nullable while the other three `text` fields in the same
 * selection set are `String!`, which GraphQL rejects outright (FieldsConflict —
 * the whole query fails, not just that fragment). The query therefore aliases
 * it and `normalizeAskMessageData` maps it back, so the core lib sees the same
 * `{ type, text, question, options }` shape the live NATS chunk carries.
 *
 * These tests pin BOTH halves together — an alias without its inverse silently
 * drops every ask intro on reload.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/feature-flags', () => ({
  featureFlags: { guideChunks: { enabled: () => true } },
}));

import { ASK_INTRO_ALIAS, getMingoDialogMessagesQuery, normalizeAskMessageData } from './dialogs-queries';

describe('getMingoDialogMessagesQuery — ask fragment', () => {
  const query = getMingoDialogMessagesQuery();

  it('fetches the ask intro under the alias, never as a bare `text`', () => {
    expect(query).toContain(`${ASK_INTRO_ALIAS}: text`);
    expect(query).toMatch(/\.\.\. on AskData \{[^}]*question/);
    // A bare `text` inside the AskData fragment is the bug this alias exists
    // for — it would collide with GuideData/TextData/ThinkingData `String!`.
    const askFragment = query.slice(query.indexOf('... on AskData'));
    expect(askFragment.slice(0, askFragment.indexOf('}'))).not.toMatch(/^\s*text\s*$/m);
  });
});

describe('normalizeAskMessageData', () => {
  it('maps the alias back onto `text`', () => {
    expect(
      normalizeAskMessageData([
        { type: 'ASK', [ASK_INTRO_ALIAS]: 'Docs, or your workspace?', question: 'Which?', options: [] },
      ]),
    ).toEqual([{ type: 'ASK', text: 'Docs, or your workspace?', question: 'Which?', options: [] }]);
  });

  it('drops a null intro instead of writing `text: null`', () => {
    expect(normalizeAskMessageData([{ type: 'ASK', [ASK_INTRO_ALIAS]: null, question: 'Which?' }])).toEqual([
      { type: 'ASK', question: 'Which?' },
    ]);
  });

  it('passes other rows through by reference', () => {
    const guide = { type: 'GUIDE', text: '## Steps' };
    const input = [guide];
    const out = normalizeAskMessageData(input);
    expect(out).toBe(input);
    expect(out[0]).toBe(guide);
  });

  it('tolerates a non-array payload', () => {
    expect(normalizeAskMessageData(undefined)).toBeUndefined();
    expect(normalizeAskMessageData(null)).toBeNull();
  });
});
