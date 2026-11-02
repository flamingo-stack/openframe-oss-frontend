/**
 * The Log Details page is loading until its request answers, and only until then: an answer with no log (a stale or
 * deleted link) ends the loading, so the page can say "Log Not Found".
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogDetails } from './use-log-details';

const post = vi.fn();

vi.mock('@/lib/api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

type LogDetailsState = ReturnType<typeof useLogDetails>;

let state: LogDetailsState;
let container: HTMLDivElement;
let root: Root;

function Probe({ onState }: { onState: (next: LogDetailsState) => void }) {
  const next = useLogDetails();
  useEffect(() => onState(next));
  return null;
}

beforeEach(() => {
  post.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
  act(() =>
    root.render(
      <Probe
        onState={next => {
          state = next;
        }}
      />,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useLogDetails', () => {
  it('has not answered before its request', () => {
    expect(state.hasAnswered).toBe(false);
  });

  it('answers with no log when the server has none', async () => {
    post.mockResolvedValue({ ok: true, data: { data: { logDetails: null } } });

    await act(() => state.fetchLogDetailsById('log-1', '2026-10-22', 'FLEET', 'EVENT', '2026-10-22T10:00:00Z'));

    expect(state.hasAnswered).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.logDetails).toBeNull();
    expect(state.error).toBeNull();
  });

  it('answers with an error when the request fails', async () => {
    post.mockResolvedValue({ ok: false, status: 500, error: 'boom' });

    await act(() =>
      state.fetchLogDetailsById('log-1', '2026-10-22', 'FLEET', 'EVENT', '2026-10-22T10:00:00Z').catch(() => {}),
    );

    expect(state.hasAnswered).toBe(true);
    expect(state.error).toBe('boom');
  });
});
