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

import { describe, expect, it } from 'vitest';

import { ASK_INTRO_ALIAS, getMingoDialogMessagesQuery, normalizeAskMessageData } from './dialogs-queries';

describe('getMingoDialogMessagesQuery — ask fragment', () => {
  const query = getMingoDialogMessagesQuery();

  it('fetches persisted V3 metadata through the backend GuideData contract', () => {
    expect(query).toMatch(/\.\.\. on GuideData \{[^}]*payload/);
    expect(query).not.toContain('... on SourcesData');
    const guideFragment = query.slice(query.indexOf('... on GuideData'));
    expect(guideFragment.slice(0, guideFragment.indexOf('}'))).not.toMatch(/^\s*text\s*$/m);
  });

  it('fetches the ask intro under the alias, never as a bare `text`', () => {
    expect(query).toContain(`${ASK_INTRO_ALIAS}: text`);
    expect(query).toMatch(/\.\.\. on AskData \{[^}]*question/);
    // A bare `text` inside the AskData fragment is the bug this alias exists
    // for — it would collide with TextData/ThinkingData `String!`.
    const askFragment = query.slice(query.indexOf('... on AskData'));
    expect(askFragment.slice(0, askFragment.indexOf('}'))).not.toMatch(/^\s*text\s*$/m);
  });

  it('keeps command execution and approval history in the same query', () => {
    expect(query).toContain('... on ExecutingToolData');
    expect(query).toContain('... on ExecutedToolData');
    expect(query).toContain('... on ApprovalRequestData');
    expect(query).toContain('... on ApprovalResultData');
    expect(query).toContain('toolExecutionRequestId');
    expect(query).toContain('toolCallArguments');
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
    const guide = { type: 'GUIDE', payload: { sources: [] } };
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
