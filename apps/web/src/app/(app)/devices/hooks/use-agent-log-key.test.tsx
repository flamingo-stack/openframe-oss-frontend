/**
 * The log key is optional in the install command, so the hook answers with
 * the key or with nothing: a tenant without one (404) or any other failure
 * leaves the flag out on the first answer, without a toast and without
 * retrying.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentLogKey } from './use-agent-log-key';

const spies = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }));

vi.mock('@/lib/api-client', () => ({ apiClient: { get: spies.get } }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: spies.toast }),
}));

const QUERY_KEY = ['agent', 'log-key'];

function Probe() {
  return <span>{useAgentLogKey() ?? 'none'}</span>;
}

let container: HTMLElement;
let root: Root;
let queryClient: QueryClient;

function mount() {
  root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
}

/** Lets the query settle until the assertion holds; a loaded CI box needs more than one tick. */
async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assertion();
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  spies.get.mockReset();
  spies.toast.mockReset();
  container = document.createElement('div');
  // The library's defaults (three retries), so the hook's own retry setting is what's under test.
  queryClient = new QueryClient();
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
});

describe('useAgentLogKey', () => {
  it('answers with the key the endpoint serves', async () => {
    spies.get.mockResolvedValue({
      ok: true,
      status: 200,
      data: { key: 'log-1', createdAt: '2026-10-22T15:43:49Z' },
    });
    mount();

    await until(() => expect(container.textContent).toBe('log-1'));
    expect(spies.get).toHaveBeenCalledWith('/api/agent/log-key');
  });

  it.each([
    ['the tenant has no log key yet', { ok: false, status: 404, error: 'Agent log key not found' }],
    ['the request is refused', { ok: false, status: 403, error: 'Forbidden' }],
    ['the server fails', { ok: false, status: 500, error: 'Internal Server Error' }],
    ['the network is down', { ok: false, status: 0, error: 'Network error' }],
  ])('answers with nothing, at once and without a toast, when %s', async (_, response) => {
    spies.get.mockResolvedValue(response);
    mount();

    // Settles on the first failure: with retries it would still be pending here.
    await until(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error'));
    expect(spies.get).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('none');
    expect(spies.toast).not.toHaveBeenCalled();
  });
});
