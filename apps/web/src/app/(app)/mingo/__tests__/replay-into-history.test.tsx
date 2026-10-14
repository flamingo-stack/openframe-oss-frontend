/**
 * What a dialog's first consumer replays into a thread history has already
 * hydrated: the real `DialogSubscription`, Mingo store and lib reducer over an
 * in-memory JetStream, started where the host starts it (`historyStreamFloor`).
 *
 * Regression for the "burst of old messages" report: history whose rows carry
 * no stream sequence started the tail at 0, and nats.ws replayed every turn the
 * stream still retained beside the persisted copies.
 */
import { MESSAGE_TYPE, processHistoricalMessagesWithErrors } from '@flamingo-stack/openframe-frontend-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSISTANT_CONFIG, CHAT_TYPE } from '../../tickets/constants';
import { DialogSubscription } from '../hooks/use-mingo-realtime-subscription';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { Message } from '../types';
import { historyStreamFloor } from '../utils/history-stream-floor';
import { countOccurrences, DIALOG, historyPage, persistedRows, publishTurn, SUBJECT, USER_ID } from './chat-fixtures';
import { FakeJetStream } from './fake-jetstream';

const server = vi.hoisted(() => ({ current: null as unknown as FakeJetStream }));
server.current = new FakeJetStream();

vi.mock('nats.ws', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  connect: () => server.current.connect(),
}));
vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'ws://fake', onBeforeReconnect: () => {} }),
}));

let root: Root | null = null;

function hydrateFromHistory(rows: Array<Record<string, unknown>>) {
  const { messages } = processHistoricalMessagesWithErrors(rows as never, {
    assistantName: ASSISTANT_CONFIG.MINGO.name,
    assistantType: ASSISTANT_CONFIG.MINGO.type,
    chatTypeFilter: CHAT_TYPE.ADMIN,
    displayApprovalTypes: ['CLIENT', 'ADMIN'],
  });
  useMingoMessagesStore.getState().setActiveDialogId(DIALOG);
  useMingoMessagesStore.getState().setMessages(DIALOG, messages as Message[]);
}

function thread(): Message[] {
  return useMingoMessagesStore.getState().messagesByDialog.get(DIALOG) ?? [];
}

async function mount(initialOptStartSeq: number | null) {
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root?.render(
      <QueryClientProvider client={new QueryClient()}>
        <DialogSubscription
          dialogId={DIALOG}
          isActive
          initialOptStartSeq={initialOptStartSeq}
          isInitialOptStartSeqReady
        />
      </QueryClientProvider>,
    );
  });
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise(r => setTimeout(r, 20));
    });
  }
}

beforeEach(() => {
  server.current.reset();
  useMingoMessagesStore.getState().resetAll();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe('DialogSubscription replay into a hydrated thread', () => {
  it('stamped history: resumes after the newest stamp and duplicates nothing', async () => {
    const turns = [0, 1, 2].map(i => publishTurn(server.current, i));
    const rows = turns.flatMap((t, i) => persistedRows(t, i, true, Date.now() - 300_000 + i * 60_000));
    hydrateFromHistory(rows);
    const before = thread().length;

    await mount(historyStreamFloor([historyPage(rows)]));
    await settle();

    expect(server.current.createdConsumers[0]).toMatchObject({ opt_start_seq: turns[2].seqs.lastContent + 1 });
    expect(thread()).toHaveLength(before);
    for (const t of turns) expect(countOccurrences(thread(), t.answer)).toBe(1);
  });

  it('unstamped history: live-tails instead of re-rendering every turn the stream retains', async () => {
    const turns = [0, 1, 2].map(i => publishTurn(server.current, i));
    const rows = turns.flatMap((t, i) => persistedRows(t, i, false, Date.now() - 300_000 + i * 60_000));
    hydrateFromHistory(rows);
    const before = thread().length;

    await mount(historyStreamFloor([historyPage(rows)]));
    await settle();

    expect(server.current.createdConsumers[0]).toMatchObject({ deliver_policy: 'new' });
    expect(thread()).toHaveLength(before);
    for (const t of turns) expect(countOccurrences(thread(), t.answer)).toBe(1);
  });

  it("a new dialog's first answer, still streaming: replays it from the stream's start", async () => {
    const userText = 'Check device 7';
    server.current.publish(SUBJECT, {
      type: MESSAGE_TYPE.MESSAGE_REQUEST,
      text: userText,
      ownerType: 'ADMIN',
      userId: USER_ID,
      displayName: 'Alex Admin',
    });
    server.current.publish(SUBJECT, { type: MESSAGE_TYPE.MESSAGE_START });
    server.current.publish(SUBJECT, { type: MESSAGE_TYPE.TEXT, text: 'Looking at device 7 now.' });
    // Only the user's row is persisted so far, and it carries no sequence.
    const [userRow] = persistedRows(publishTurn(new FakeJetStream(), 7), 7, true, Date.now());
    const rows = [{ ...userRow, messageData: [{ type: MESSAGE_TYPE.TEXT, text: userText }] }];
    hydrateFromHistory(rows);

    await mount(historyStreamFloor([historyPage(rows)]));
    await settle();

    expect(server.current.createdConsumers[0]).toMatchObject({ deliver_policy: 'by_start_sequence', opt_start_seq: 1 });
    expect(countOccurrences(thread(), 'Looking at device 7 now.')).toBe(1);
  });
});
