/**
 * Pins the manual-compaction contract: the request goes out only once the
 * dialog's live-tail consumer exists, the result toast comes from the stream
 * (CONTEXT_COMPACTION_END, an ERROR chunk, or MESSAGE_END) rather than from the
 * request's 202, and chunks from the turn the dialog was finishing when the
 * request went out do not count.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMingoCompactionStore } from '../(app)/mingo/stores/mingo-compaction-store';
import {
  COMPACTION_STREAM_START_TIMEOUT_MS,
  COMPACTION_WATCH_TIMEOUT_MS,
  MingoCompactionWatchers,
} from './mingo-compaction-watchers';

interface StreamOptions {
  dialogId: string;
  optStartSeq: number | null;
  onEvent: (payload: unknown) => void;
  onSubscribed: () => void;
}

const { streams, toast, dismiss, post } = vi.hoisted(() => {
  let toastCount = 0;
  return {
    streams: new Map<string, StreamOptions>(),
    toast: vi.fn((_options: Record<string, unknown>) => `toast-${++toastCount}`),
    dismiss: vi.fn(),
    post: vi.fn(),
  };
});

vi.mock('@flamingo-stack/openframe-frontend-core', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useJetStreamDialogSubscription: (options: StreamOptions) => {
    streams.set(options.dialogId, options);
    return { isSubscribed: true, reconnectionCount: 0 };
  },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast, dismiss }),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: { post } }));

vi.mock('@/lib/nats/nats-app-config', () => ({
  useNatsAppConfig: () => ({ getWsUrl: () => 'ws://nats', onBeforeReconnect: vi.fn() }),
}));

let container: HTMLDivElement;
let root: Root;

function stream(dialogId: string): StreamOptions {
  const options = streams.get(dialogId);
  if (!options) throw new Error(`no stream for ${dialogId}`);
  return options;
}

async function subscribe(dialogId: string) {
  await act(async () => {
    stream(dialogId).onSubscribed();
  });
}

function emit(dialogId: string, chunk: Record<string, unknown>) {
  act(() => {
    stream(dialogId).onEvent(chunk);
  });
}

function start(dialogId: string) {
  act(() => {
    useMingoCompactionStore.getState().startCompaction(dialogId);
  });
}

/** Holds the compact request open until the test answers it. */
function deferPost() {
  let answer: (response: unknown) => void = () => {};
  post.mockReturnValue(
    new Promise(resolve => {
      answer = resolve;
    }),
  );
  return async (response: unknown) => {
    await act(async () => {
      answer(response);
    });
  };
}

const compacting = () => useMingoCompactionStore.getState().compactingDialogIds;
const lastToast = () => toast.mock.calls.at(-1)?.[0];
const progressToastId = () => toast.mock.results[0]?.value;

describe('MingoCompactionWatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streams.clear();
    post.mockResolvedValue({ ok: true, status: 202 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <MingoCompactionWatchers />
        </QueryClientProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('live-tails the dialog and sends the request only once the consumer exists', async () => {
    start('d-1');

    expect(stream('d-1').optStartSeq).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Compacting chat memory…' }));
    expect(post).not.toHaveBeenCalled();

    await subscribe('d-1');
    await subscribe('d-1');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/chat/api/v1/dialogs/d-1/compact');
  });

  it('reports success on MESSAGE_END after CONTEXT_COMPACTION_END, not on the 202', async () => {
    start('d-1');
    await subscribe('d-1');
    expect(lastToast()?.title).toBe('Compacting chat memory…');

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'CONTEXT_COMPACTION_END' });
    expect(lastToast()?.title).toBe('Compacting chat memory…');

    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()).toMatchObject({ title: 'Chat memory compacted', variant: 'success' });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(progressToastId());
    expect(compacting()).toEqual([]);
  });

  it('reports the ERROR chunk details when the compaction fails', async () => {
    start('d-1');
    await subscribe('d-1');

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'ERROR', error: 'Context compaction error', details: 'model unavailable' });
    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()).toMatchObject({ description: 'model unavailable', variant: 'destructive' });
    expect(compacting()).toEqual([]);
  });

  it('falls back to its own message when the ERROR chunk carries no text', async () => {
    start('d-1');
    await subscribe('d-1');

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'ERROR', details: { unexpected: true } });
    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()).toMatchObject({ description: 'Failed to compact chat memory', variant: 'destructive' });
  });

  it('says there is nothing to compact when the backend refuses with 422', async () => {
    post.mockResolvedValue({ ok: false, status: 422, error: 'Dialog context has no assistant messages to compact' });
    start('d-1');
    await subscribe('d-1');

    expect(lastToast()).toMatchObject({ title: 'Nothing to compact yet' });
    expect(lastToast()?.variant).toBeUndefined();
    expect(dismiss).toHaveBeenCalledWith(progressToastId());
    expect(compacting()).toEqual([]);
  });

  it('does not take a MESSAGE_END without a START as the end of the compaction, even after the 202', async () => {
    start('d-1');
    await subscribe('d-1');

    emit('d-1', { type: 'MESSAGE_END' });
    expect(compacting()).toEqual(['d-1']);

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'CONTEXT_COMPACTION_END' });
    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()?.title).toBe('Chat memory compacted');
  });

  it('ends at once when the backend refuses a dialog that is mid-turn', async () => {
    post.mockResolvedValue({ ok: false, status: 409, error: 'Conflict' });
    start('d-1');
    await subscribe('d-1');

    expect(lastToast()).toMatchObject({
      description: 'Mingo is still working on this chat. Try again once it finishes.',
      variant: 'destructive',
    });
    expect(compacting()).toEqual([]);
  });

  it("ignores the finishing turn's ERROR and MESSAGE_END that arrive before the 409", async () => {
    const answer = deferPost();
    start('d-1');
    await subscribe('d-1');

    emit('d-1', { type: 'ERROR', details: 'the previous turn failed' });
    emit('d-1', { type: 'MESSAGE_END' });
    expect(compacting()).toEqual(['d-1']);

    await answer({ ok: false, status: 409, error: 'Conflict' });

    expect(lastToast()?.description).toBe('Mingo is still working on this chat. Try again once it finishes.');
  });

  it("ignores the finishing turn's MESSAGE_END and reports the compaction that follows", async () => {
    const answer = deferPost();
    start('d-1');
    await subscribe('d-1');

    emit('d-1', { type: 'MESSAGE_END' });
    await answer({ ok: true, status: 202 });
    expect(compacting()).toEqual(['d-1']);

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'CONTEXT_COMPACTION_END' });
    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()?.title).toBe('Chat memory compacted');
  });

  it('keeps watching when the request gets no answer, and reports what the stream says', async () => {
    post.mockResolvedValue({ ok: false, status: 0, error: 'Request timed out after 30000ms' });
    start('d-1');
    await subscribe('d-1');
    emit('d-1', { type: 'MESSAGE_END' });
    expect(compacting()).toEqual(['d-1']);

    emit('d-1', { type: 'CONTEXT_COMPACTION_START' });
    emit('d-1', { type: 'CONTEXT_COMPACTION_END' });
    emit('d-1', { type: 'MESSAGE_END' });

    expect(lastToast()?.title).toBe('Chat memory compacted');
  });

  it('reports a request that throws as a failure', async () => {
    post.mockRejectedValue(new Error('boom'));
    start('d-1');
    await subscribe('d-1');

    expect(lastToast()).toMatchObject({ description: 'Failed to compact chat memory', variant: 'destructive' });
    expect(compacting()).toEqual([]);
  });

  it('shows nothing for a request answered after its watcher is gone', async () => {
    const answer = deferPost();
    start('d-1');
    await subscribe('d-1');

    act(() => root.unmount());
    const toastsBeforeAnswer = toast.mock.calls.length;
    await answer({ ok: false, status: 409, error: 'Conflict' });

    expect(dismiss).toHaveBeenCalledWith(progressToastId());
    expect(toast).toHaveBeenCalledTimes(toastsBeforeAnswer);
    root = createRoot(container);
  });

  it('gives up without sending anything when the stream never goes live', () => {
    vi.useFakeTimers();
    start('d-1');

    act(() => {
      vi.advanceTimersByTime(COMPACTION_STREAM_START_TIMEOUT_MS);
    });

    expect(post).not.toHaveBeenCalled();
    expect(lastToast()?.description).toBe("Couldn't start compacting this chat. Try again in a moment.");
    expect(compacting()).toEqual([]);
  });

  it('gives up on a stream that never ends the turn', async () => {
    vi.useFakeTimers();
    start('d-1');
    await subscribe('d-1');

    act(() => {
      vi.advanceTimersByTime(COMPACTION_WATCH_TIMEOUT_MS);
    });

    expect(lastToast()).toMatchObject({ variant: 'destructive' });
    expect(String(lastToast()?.description)).toContain("Couldn't confirm the compaction finished");
    expect(compacting()).toEqual([]);
  });
});
