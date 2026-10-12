/**
 * Keep and Release change the recording page, the Remote Sessions list and
 * the storage pools at once, so a success refreshes all three; a refusal
 * toasts the server's message.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceQueryKeys } from '../utils/query-keys';
import { useKeepSessionRecording, useReleaseSessionRecording } from './use-session-recordings';

const spies = vi.hoisted(() => ({
  toast: vi.fn<(options: Record<string, unknown>) => void>(),
  keep: vi.fn<(sessionId: string, selection: unknown) => Promise<void>>(),
  release: vi.fn<(sessionId: string) => Promise<void>>(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));
vi.mock('../services/session-recordings-api-service', () => ({
  sessionRecordingsApiService: { keep: spies.keep, release: spies.release },
}));
vi.mock('./use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => 'on' }));

type Mutations = {
  keep: ReturnType<typeof useKeepSessionRecording>;
  release: ReturnType<typeof useReleaseSessionRecording>;
};

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let mutations: Mutations | null = null;

function Probe({ onReady }: { onReady: (value: Mutations) => void }) {
  const keep = useKeepSessionRecording('machine-1');
  const release = useReleaseSessionRecording('machine-1');
  useEffect(() => onReady({ keep, release }));
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  container = document.createElement('div');
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe
          onReady={value => {
            mutations = value;
          }}
        />
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  vi.clearAllMocks();
  mutations = null;
});

/** The query keys `invalidateQueries` was called with. */
function invalidatedKeys(client: QueryClient, run: () => Promise<void>) {
  const spy = vi.spyOn(client, 'invalidateQueries');
  return run().then(() => spy.mock.calls.map(([filters]) => filters?.queryKey));
}

describe('Keep and Release hooks', () => {
  it('keeps by session id, then refreshes the list, the page and the storage', async () => {
    spies.keep.mockResolvedValueOnce(undefined);
    const selection = { reason: 'CLIENT_DISPUTE' as const, description: null };

    let keys: unknown[] = [];
    await act(async () => {
      keys = await invalidatedKeys(queryClient, async () => {
        await mutations?.keep.mutateAsync({ sessionId: 'session-1', recordingId: 'rec-1', selection });
      });
    });

    expect(spies.keep).toHaveBeenCalledWith('session-1', selection);
    expect(keys).toEqual(
      expect.arrayContaining([
        deviceQueryKeys.sessionRecordings('machine-1'),
        deviceQueryKeys.sessionRecording('rec-1'),
        deviceQueryKeys.recordingStorage(),
      ]),
    );
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recording Kept', variant: 'success' }));
  });

  it('releases by session id and toasts a refusal with the server message', async () => {
    spies.release.mockResolvedValueOnce(undefined);
    await act(async () => {
      await mutations?.release.mutateAsync({ sessionId: 'session-1', recordingId: 'rec-1' });
    });
    expect(spies.release).toHaveBeenCalledWith('session-1');
    expect(spies.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Keeping Released', variant: 'success' }),
    );

    spies.keep.mockRejectedValueOnce(new Error('The kept allowance is full'));
    await act(async () => {
      await mutations?.keep
        .mutateAsync({
          sessionId: 'session-1',
          recordingId: 'rec-1',
          selection: { reason: 'OTHER', description: 'Dispute' },
        })
        .catch(() => undefined);
    });
    expect(spies.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: 'The kept allowance is full', variant: 'destructive' }),
    );
  });
});
