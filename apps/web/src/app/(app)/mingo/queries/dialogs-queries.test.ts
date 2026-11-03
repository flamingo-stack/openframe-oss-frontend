/**
 * The ASK intro alias and its inverse are pinned TOGETHER on purpose.
 *
 * The alias exists because `AskData.text` is `String` while the other `text`
 * fields in the same selection set are `String!` — GraphQL rejects the whole
 * query over that, not just the fragment. `normalizeAskMessageData` maps the
 * alias back so the core lib sees the same shape the live NATS chunk carries.
 * An alias without its inverse is silent: every ask intro simply disappears on
 * reload. So neither half gets a test of its own.
 */

import { processHistoricalMessages } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it } from 'vitest';
import {
  ASK_INTRO_ALIAS,
  GET_MINGO_DIALOGS_QUERY,
  GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY,
  getMingoDialogMessagesQuery,
  normalizeAskMessageData,
} from './dialogs-queries';

/** The body of `... on <TypeName> { … }` in the messages query, nested selections included. */
function fragmentBody(query: string, typeName: string): string {
  const start = query.indexOf(`... on ${typeName} {`);
  expect(start, `no fragment for ${typeName}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let index = query.indexOf('{', start); index < query.length; index++) {
    if (query[index] === '{') depth++;
    if (query[index] === '}' && --depth === 0) return query.slice(start, index);
  }
  return query.slice(start);
}

describe('getMingoDialogMessagesQuery', () => {
  const query = getMingoDialogMessagesQuery();
  const legacyQuery = getMingoDialogMessagesQuery({ legacyGuide: true });
  const oldNamesQuery = getMingoDialogMessagesQuery({ standardNames: false });

  it('fetches an answer’s sources in the standard names', () => {
    const attachments = fragmentBody(query, 'AttachmentsData');
    for (const field of ['type', 'sourceId', 'url', 'title', 'mediaType', 'filename']) {
      expect(attachments).toMatch(new RegExp(`^\\s*${field}\\s*$`, 'm'));
    }
    for (const old of ['externalUrl', 'documentType', 'items {', 'videos {', 'cards {']) {
      expect(attachments).not.toContain(old);
    }
  });

  it('fetches the old names for a backend from before them, for the same rows', () => {
    const attachments = fragmentBody(oldNamesQuery, 'AttachmentsData');
    for (const selection of ['sources {', 'items {', 'videos {', 'metadata {', 'cards {', 'externalUrl']) {
      expect(attachments).toContain(selection);
    }
    expect(attachments).not.toContain('sourceId');
    expect(fragmentBody(oldNamesQuery, 'RecordCardsData')).toContain('cards {');
  });

  it('never asks one schema for both attachment types', () => {
    // A fragment on a type the schema lacks fails the whole query.
    expect(query).not.toContain('GuideData');
    expect(legacyQuery).not.toContain('AttachmentsData');
    expect(fragmentBody(legacyQuery, 'GuideData')).toContain('payload');
  });

  it('fetches an answer’s record cards, and leaves them out for a backend that has none', () => {
    expect(fragmentBody(query, 'RecordCardsData')).toContain('records');
    expect(fragmentBody(query, 'RecordCardsData')).not.toContain('cards {');
    expect(getMingoDialogMessagesQuery({ recordCards: false })).not.toContain('RecordCardsData');
  });

  it('keeps the container `messageData`: every tenant has it', () => {
    expect(query).toContain('messageData {');
    expect(oldNamesQuery).toContain('messageData {');
  });

  it('does not select GuideData.text', () => {
    // Payload-only records persist `text` as an empty non-null string, which
    // would replay as an empty text segment above the answer.
    expect(fragmentBody(legacyQuery, 'GuideData')).not.toMatch(/^\s*text\s*$/m);
  });

  it('fetches the ask intro under the alias, never as a bare `text`', () => {
    expect(fragmentBody(query, 'AskData')).toContain(`${ASK_INTRO_ALIAS}: text`);
    expect(fragmentBody(query, 'AskData')).not.toMatch(/^\s*text\s*$/m);
    expect(fragmentBody(query, 'AskData')).toContain('question');
  });

  it('keeps remote write-tool approvals selecting their public arguments', () => {
    // The approval card renders `toolTitle` + `toolExplanation` + the public
    // arguments; MCP provider and trust metadata never reach the frontend.
    const approval = fragmentBody(query, 'ApprovalRequestData');
    expect(approval).toContain('toolTitle');
    expect(approval).toContain('toolExplanation');
    expect(approval).toContain('toolCallArguments');
  });
});

/** A persisted answer as the new fragments answer it: GraphQL answers an unset field with null. */
const answerRow = (messageData: unknown[]) =>
  ({
    id: 'row-1',
    dialogId: 'dialog-1',
    chatType: 'ADMIN_AI_CHAT',
    createdAt: '2026-11-02T10:00:00Z',
    owner: { type: 'ASSISTANT' },
    messageData,
  }) as never;

describe('history through the new fragments', () => {
  it('reads the sources and the cards as parts of the answer', () => {
    const { messages } = processHistoricalMessages([
      answerRow([
        { type: 'TEXT', text: 'Here is the post.' },
        {
          type: 'ATTACHMENTS',
          sources: [
            {
              type: 'source-url',
              sourceId: 'record://blog_post/1108',
              url: 'https://www.flamingo.run/blog/openframe-vs-atera',
              title: 'OpenFrame vs Atera',
              mediaType: null,
              filename: null,
            },
            {
              type: 'source-document',
              sourceId: 'record://hubspot_ticket_anon/48582802965',
              url: null,
              title: 'Agent offline after upgrade',
              mediaType: 'text/plain',
              filename: null,
            },
          ],
        },
        { type: 'RECORD_CARDS', records: ['record://blog_post/1108'] },
      ]),
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].parts).toEqual([
      {
        type: 'source-url',
        sourceId: 'record://blog_post/1108',
        url: 'https://www.flamingo.run/blog/openframe-vs-atera',
        title: 'OpenFrame vs Atera',
      },
      {
        type: 'source-document',
        sourceId: 'record://hubspot_ticket_anon/48582802965',
        mediaType: 'text/plain',
        title: 'Agent offline after upgrade',
      },
      { type: 'text', text: 'Here is the post.', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
    ]);
  });

  it('reads the same rows through the old fragments, on a tenant that still answers them', () => {
    const { messages } = processHistoricalMessages([
      answerRow([
        { type: 'TEXT', text: 'Here is the post.' },
        {
          type: 'ATTACHMENTS',
          sources: [
            {
              index: 1,
              name: 'OpenFrame vs Atera',
              documentType: 'blog_post',
              id: '1108',
              externalUrl: 'https://www.flamingo.run/blog/openframe-vs-atera',
            },
          ],
          videos: [],
          cards: [],
        },
        { type: 'RECORD_CARDS', cards: [{ entityType: 'blog_post', entityId: '1108' }] },
      ]),
    ]);

    expect(messages[0].parts).toEqual([
      {
        type: 'source-url',
        sourceId: 'record://blog_post/1108',
        url: 'https://www.flamingo.run/blog/openframe-vs-atera',
        title: 'OpenFrame vs Atera',
      },
      { type: 'text', text: 'Here is the post.', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
    ]);
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

  it('normalizes a single non-list messageData', () => {
    expect(normalizeAskMessageData({ type: 'ASK', [ASK_INTRO_ALIAS]: 'Pick one', question: 'Which?' })).toEqual({
      type: 'ASK',
      text: 'Pick one',
      question: 'Which?',
    });
  });

  it('drops a null intro instead of writing `text: null`', () => {
    // The live chunk omits the intro entirely when there is none — the two
    // shapes have to stay identical.
    expect(normalizeAskMessageData([{ type: 'ASK', [ASK_INTRO_ALIAS]: null, question: 'Which?' }])).toEqual([
      { type: 'ASK', question: 'Which?' },
    ]);
  });

  it('passes other rows through by reference', () => {
    const attachments = { type: 'ATTACHMENTS', sources: [], videos: [], cards: [] };
    const input = [attachments];
    const output = normalizeAskMessageData(input);

    expect(output).toBe(input);
    expect(output[0]).toBe(attachments);
  });

  it('tolerates a missing payload', () => {
    expect(normalizeAskMessageData(undefined)).toBeUndefined();
    expect(normalizeAskMessageData(null)).toBeNull();
  });
});

/**
 * A backend without `Dialog.pendingApproval` rejects any query that names it, so
 * only the Mingo v2 list asks: the base query feeds v1, the archive and incidents.
 */
describe('the chat list queries', () => {
  it('leave pendingApproval out of the base query', () => {
    expect(GET_MINGO_DIALOGS_QUERY).not.toContain('pendingApproval');
    expect(GET_MINGO_DIALOGS_QUERY).toContain('streamState');
  });

  it('add it to the v2 list query and nothing else', () => {
    const withoutField = GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY.replace(
      /\s*pendingApproval \{\s*id\s*approvalType\s*\}/,
      '',
    );
    expect(GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY).toContain('pendingApproval');
    expect(withoutField.replace(/\s+/g, ' ')).toBe(GET_MINGO_DIALOGS_QUERY.replace(/\s+/g, ' '));
  });
});
