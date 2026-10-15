/**
 * Mingo turns as the ai-agent publishes and persists them, plus the history and
 * store helpers the replay regression suite in this folder shares.
 */
import {
  CHAT_TYPE,
  MESSAGE_TYPE,
  OWNER_TYPE,
  processHistoricalMessagesWithErrors,
} from '@flamingo-stack/openframe-frontend-core';
import { ASSISTANT_CONFIG } from '../../tickets/constants';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { Message, MessagePage } from '../types';
import type { FakeJetStream } from './fake-jetstream';

export const DIALOG = 'dlg-1';
export const SUBJECT = `chat.${DIALOG}.admin-message`;
export const USER_ID = 'admin-user-1';

/** The dialog's thread as the Mingo store mirrors it. */
export function thread(): Message[] {
  return useMingoMessagesStore.getState().messagesByDialog.get(DIALOG) ?? [];
}

/** Persisted rows → thread rows, with the options `use-mingo-dialog-selection`
 *  passes (not its approve/reject handlers, `approvalStatuses` or
 *  pending-approvals fold). */
export function processMingoHistory(rows: ReadonlyArray<Record<string, unknown>>): Message[] {
  return processHistoricalMessagesWithErrors(rows as never, {
    assistantName: ASSISTANT_CONFIG.MINGO.name,
    assistantType: ASSISTANT_CONFIG.MINGO.type,
    chatTypeFilter: CHAT_TYPE.ADMIN,
    displayApprovalTypes: ['CLIENT', 'ADMIN'],
  }).messages as Message[];
}

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

interface RenderedSegment {
  type: string;
  text?: string;
  status?: string;
  data?: {
    parameters?: { script?: string };
    approvalRequestId?: string;
    toolCalls?: Array<{ toolExecutionRequestId: string; toolCallArguments?: { script?: string } | null }>;
    executions?: Record<string, { status: string; result?: string }>;
  };
}

/** Text of every segment / string content, for duplicate counting. An approval
 *  batch renders its id, status, scripts and every run's result. */
export function renderedText(m: { content: unknown }): string {
  if (typeof m.content === 'string') return m.content;
  if (!Array.isArray(m.content)) return '';
  return (m.content as RenderedSegment[])
    .map(s => {
      if (s.type === 'text') return s.text ?? '';
      if (s.type === 'tool_execution') return `[tool ${s.data?.parameters?.script ?? ''}]`;
      if (s.type === 'approval_batch') {
        const runs = (s.data?.toolCalls ?? []).map(call => {
          const run = s.data?.executions?.[call.toolExecutionRequestId];
          return `${call.toolCallArguments?.script ?? ''} => ${run ? `${run.status}:${run.result ?? ''}` : 'queued'}`;
        });
        return `[batch ${s.data?.approvalRequestId ?? ''} ${s.status ?? ''} ${runs.join('; ')}]`;
      }
      return `[${s.type}]`;
    })
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

type Row = Record<string, unknown> & { id: string; createdAt: string; lastChunkStreamSeq: number | null };

export interface ApprovalRound {
  approvalId: string;
  toolId: string;
  script: string;
  output: string;
  /** What the resumed run says after the command ran. */
  followUp: string;
}

/**
 * A Mingo turn that pauses for approval, then approve → run-command rounds, as
 * the ai-agent publishes and persists them (saas-tenant main, 2026-10-14):
 *
 * - the turn: MESSAGE_REQUEST, MESSAGE_START, TEXT, APPROVAL_REQUEST (a batch
 *   carrying the script), MESSAGE_END — a run that pauses for approval ends
 *   (`BatchApprovalFailureHandler` → `RunTerminationCoordinator.endRun`);
 * - each approval: APPROVAL_RESULT (`CommandApprovalService`), EXECUTING_TOOL
 *   and EXECUTED_TOOL (`CommandApproveProcessor`), then the resumed run with
 *   NO MESSAGE_START — only a user message opens one — saying `followUp`,
 *   asking for the next approval unless it is the last round, MESSAGE_END.
 *
 * Every row but the user's is stamped with its own chunk's sequence (text: its
 * latest TEXT). `createdAt` follows the session clock (`at`), which the test
 * moves — an approval can wait minutes — so a bubble showing receipt time
 * instead of its rows' time is visible.
 */
export class ApprovalSession {
  readonly rows: Row[] = [];
  readonly rounds: ApprovalRound[] = [];
  readonly userText: string;
  readonly intro: string;

  constructor(
    private readonly js: FakeJetStream,
    private readonly turn: number,
    /** The session clock, in ms; rows are created at it. */
    public at: number,
  ) {
    this.userText = `Onboard every device of site ${turn} to Defender`;
    this.intro = `I'll run the onboarding script for site ${turn}, one device at a time.`;
  }

  private round(k: number): ApprovalRound {
    return {
      approvalId: `apr-${this.turn}-${k}`,
      toolId: `run-${this.turn}-${k}`,
      script: `WindowsDefenderATPOnboardingScript.cmd /site ${this.turn} /device ${k}`,
      output: `Device ${k} of site ${this.turn}: onboarded`,
      followUp: `Device ${k} is done.`,
    };
  }

  private row(owner: 'ADMIN' | 'ASSISTANT', seq: number | null, messageData: Record<string, unknown>): void {
    this.at += 1000;
    this.rows.push({
      id: `mongo-${this.turn}-${this.rows.length}`,
      dialogId: DIALOG,
      chatType: CHAT_TYPE.ADMIN,
      createdAt: new Date(this.at).toISOString(),
      lastChunkStreamSeq: seq,
      owner:
        owner === 'ADMIN'
          ? { type: OWNER_TYPE.ADMIN, user: { id: USER_ID, firstName: 'Alex', lastName: 'Admin' } }
          : { type: OWNER_TYPE.ASSISTANT },
      messageData: [messageData],
    });
  }

  private requestApproval(k: number): void {
    const r = this.round(k);
    const data = {
      type: MESSAGE_TYPE.APPROVAL_REQUEST,
      approvalRequestId: r.approvalId,
      approvalType: 'ADMIN',
      toolCalls: [
        {
          toolExecutionRequestId: r.toolId,
          toolName: 'run_script',
          toolTitle: 'Run script',
          toolType: 'OPENFRAME_RMM',
          requiresApproval: true,
          approvalType: 'ADMIN',
          toolCallArguments: { script: r.script },
        },
      ],
    };
    this.row('ASSISTANT', this.js.publish(SUBJECT, data), data);
    this.js.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_END });
  }

  /** The user's message, the intro, and the first approval request. */
  start(): this {
    const request = { type: MESSAGE_TYPE.MESSAGE_REQUEST, text: this.userText, ownerType: 'ADMIN', userId: USER_ID };
    this.js.publish(SUBJECT, { ...request, displayName: 'Alex Admin' });
    this.row('ADMIN', null, { type: MESSAGE_TYPE.TEXT, text: this.userText });
    this.js.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_START });
    const intro = { type: MESSAGE_TYPE.TEXT, text: this.intro };
    this.row('ASSISTANT', this.js.publish(SUBJECT, intro), intro);
    this.requestApproval(0);
    return this;
  }

  /** The admin approves the pending request; the command runs and the run resumes. */
  approve({ last = false } = {}): ApprovalRound {
    const k = this.rounds.length;
    const r = this.round(k);
    this.rounds.push(r);
    const result = {
      type: MESSAGE_TYPE.APPROVAL_RESULT,
      approvalRequestId: r.approvalId,
      approved: true,
      approvalType: 'ADMIN',
      userId: USER_ID,
    };
    this.row('ASSISTANT', this.js.publish(SUBJECT, { ...result, displayName: 'Alex Admin' }), {
      ...result,
      resolvedByName: 'Alex Admin',
    });
    const tool = {
      integratedToolType: 'OPENFRAME_RMM',
      toolFunction: 'run_script',
      toolExecutionRequestId: r.toolId,
    };
    const executing = {
      ...tool,
      type: MESSAGE_TYPE.EXECUTING_TOOL,
      title: 'Run script',
      parameters: { script: r.script },
    };
    this.row('ASSISTANT', this.js.publish(SUBJECT, executing), executing);
    const executed = { ...tool, type: MESSAGE_TYPE.EXECUTED_TOOL, result: r.output, success: true };
    this.row('ASSISTANT', this.js.publish(SUBJECT, executed), executed);
    const followUp = { type: MESSAGE_TYPE.TEXT, text: r.followUp };
    this.row('ASSISTANT', this.js.publish(SUBJECT, followUp), followUp);
    if (last) this.js.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_END });
    else this.requestApproval(k + 1);
    return r;
  }
}
