/**
 * Mingo turns as the ai-agent publishes and persists them, for the replay
 * regression suite in this folder.
 */
import { CHAT_TYPE, MESSAGE_TYPE, OWNER_TYPE } from '@flamingo-stack/openframe-frontend-core';
import type { MessagePage } from '../types';
import type { FakeJetStream } from './fake-jetstream';

export const DIALOG = 'dlg-1';
export const SUBJECT = `chat.${DIALOG}.admin-message`;
export const USER_ID = 'admin-user-1';

export interface PublishedTurn {
  userText: string;
  answer: string;
  script: string;
  output: string;
  toolId: string;
  /** seq of every chunk, by role in the turn */
  seqs: {
    request: number;
    start: number;
    firstContent: number;
    executing: number;
    executed: number;
    lastContent: number;
    end: number;
    usage: number;
  };
}

/**
 * One Mingo turn as the ai-agent publishes it on `chat.<dialogId>.admin-message`:
 * MESSAGE_REQUEST echo, MESSAGE_START, text, EXECUTING_TOOL (carries the
 * script), EXECUTED_TOOL (carries the output), answer text, MESSAGE_END,
 * TOKEN_USAGE. `noise` interleaves other dialogs' chunks (the stream is shared).
 */
export function publishTurn(js: FakeJetStream, i: number, noise = 3): PublishedTurn {
  const userText = `Run the Defender onboarding check on device ${i}`;
  const script = `# onboarding script ${i}\n$OrgId = "ORG-SECRET-${i}"\nWindowsDefenderATPOnboardingScript.cmd`;
  const output = `Onboarding state for device ${i}: OK`;
  const answer = `Device ${i} is onboarded.`;
  const toolId = `tool-${i}`;
  const request = js.publish(SUBJECT, {
    type: MESSAGE_TYPE.MESSAGE_REQUEST,
    text: userText,
    ownerType: 'ADMIN',
    userId: USER_ID,
    displayName: 'Alex Admin',
  });
  js.publishNoise(noise);
  const start = js.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_START });
  const firstContent = js.publish(SUBJECT, { type: MESSAGE_TYPE.TEXT, text: `Checking device ${i}. ` });
  const executing = js.publish(SUBJECT, {
    type: MESSAGE_TYPE.EXECUTING_TOOL,
    toolExecutionRequestId: toolId,
    integratedToolType: 'OPENFRAME',
    toolFunction: 'run_script',
    title: 'Run script',
    parameters: { script },
  });
  js.publishNoise(noise);
  const executed = js.publish(SUBJECT, {
    type: MESSAGE_TYPE.EXECUTED_TOOL,
    toolExecutionRequestId: toolId,
    integratedToolType: 'OPENFRAME',
    toolFunction: 'run_script',
    title: 'Run script',
    parameters: { script },
    result: output,
    success: true,
  });
  const lastContent = js.publish(SUBJECT, { type: MESSAGE_TYPE.TEXT, text: answer });
  const end = js.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_END });
  const usage = js.publish(SUBJECT, {
    type: MESSAGE_TYPE.TOKEN_USAGE,
    inputTokensSize: 10,
    outputTokensSize: 10,
    totalTokensSize: 20,
    contextSize: 200000,
  });
  js.publishNoise(noise);
  return {
    userText,
    answer,
    script,
    output,
    toolId,
    seqs: { request, start, firstContent, executing, executed, lastContent, end, usage },
  };
}

/**
 * The persisted rows for a turn, as the ai-agent writes them (one Message per
 * segment): the AI-mode user row with NO seq; the text flushed before the tool
 * with the seq of its latest TEXT chunk; each tool chip with its own chunk seq;
 * the final text with its latest TEXT chunk seq. `stamp: false` drops every seq,
 * as an ai-agent that did not stamp rows wrote them.
 */
export function persistedRows(turn: PublishedTurn, i: number, stamp: boolean, at: number) {
  const seq = (n: number) => (stamp ? n : null);
  const base = { dialogId: DIALOG, chatType: CHAT_TYPE.ADMIN, owner: { type: OWNER_TYPE.ASSISTANT } };
  const tool = {
    toolExecutionRequestId: turn.toolId,
    integratedToolType: 'OPENFRAME',
    toolFunction: 'run_script',
    title: 'Run script',
    parameters: { script: turn.script },
  };
  return [
    {
      id: `mongo-user-${i}`,
      dialogId: DIALOG,
      chatType: CHAT_TYPE.ADMIN,
      createdAt: new Date(at).toISOString(),
      lastChunkStreamSeq: null,
      owner: { type: OWNER_TYPE.ADMIN, user: { id: USER_ID, firstName: 'Alex', lastName: 'Admin' } },
      messageData: [{ type: MESSAGE_TYPE.TEXT, text: turn.userText }],
    },
    {
      ...base,
      id: `mongo-text1-${i}`,
      createdAt: new Date(at + 1000).toISOString(),
      lastChunkStreamSeq: seq(turn.seqs.firstContent),
      messageData: [{ type: MESSAGE_TYPE.TEXT, text: `Checking device ${i}. ` }],
    },
    {
      ...base,
      id: `mongo-exec-${i}`,
      createdAt: new Date(at + 1100).toISOString(),
      lastChunkStreamSeq: seq(turn.seqs.executing),
      messageData: [{ type: MESSAGE_TYPE.EXECUTING_TOOL, ...tool }],
    },
    {
      ...base,
      id: `mongo-done-${i}`,
      createdAt: new Date(at + 1200).toISOString(),
      lastChunkStreamSeq: seq(turn.seqs.executed),
      messageData: [{ type: MESSAGE_TYPE.EXECUTED_TOOL, ...tool, result: turn.output, success: true }],
    },
    {
      ...base,
      id: `mongo-asst-${i}`,
      createdAt: new Date(at + 1300).toISOString(),
      lastChunkStreamSeq: seq(turn.seqs.lastContent),
      messageData: [{ type: MESSAGE_TYPE.TEXT, text: turn.answer }],
    },
  ];
}

/** Text of every segment / string content, for duplicate counting. */
export function renderedText(m: { content: unknown }): string {
  if (typeof m.content === 'string') return m.content;
  if (!Array.isArray(m.content)) return '';
  return (m.content as Array<{ type: string; text?: string; data?: { parameters?: { script?: string } } }>)
    .map(s =>
      s.type === 'text'
        ? (s.text ?? '')
        : s.type === 'tool_execution'
          ? `[tool ${s.data?.parameters?.script ?? ''}]`
          : `[${s.type}]`,
    )
    .join('|');
}

export function countOccurrences(messages: Array<{ content: unknown }>, needle: string): number {
  return messages.filter(m => renderedText(m).includes(needle)).length;
}

/** Rows as the newest-first history page the messages query returns. */
export function historyPage(rows: ReturnType<typeof persistedRows>): MessagePage {
  return {
    messages: [...rows].reverse() as unknown as MessagePage['messages'],
    pageInfo: { hasNextPage: false, hasPreviousPage: false },
  };
}
