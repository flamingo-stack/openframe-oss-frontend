/**
 * The log key is optional in the install command, so the hook answers with
 * the key or with nothing, never with a toast. A 4xx (the 404 of a tenant
 * without a key) is the answer, asked once; no answer or a 5xx is retried, so
 * a blip at mount does not drop the key for the whole visit.
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
const SERVED = { ok: true, status: 200, data: { key: 'log-1', createdAt: '2026-10-22T15:43:49Z' } };

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
  // The library's default of three retries, so the hook's own retry setting is what's under test;
  // no delay between them, so the test does not wait the real backoff out.
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
});

describe('useAgentLogKey', () => {
  it('answers with the key the endpoint serves', async () => {
    spies.get.mockResolvedValue(SERVED);
    mount();

    await until(() => expect(container.textContent).toBe('log-1'));
    expect(spies.get).toHaveBeenCalledWith('/api/agent/log-key');
  });

  it.each([
    ['the tenant has no log key yet', { ok: false, status: 404, error: 'Agent log key not found' }],
    ['the request is refused', { ok: false, status: 403, error: 'Forbidden' }],
  ])('answers with nothing, asked once and without a toast, when %s', async (_, response) => {
    spies.get.mockResolvedValue(response);
    mount();

    await until(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('success'));
    expect(spies.get).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('none');
    expect(spies.toast).not.toHaveBeenCalled();
  });

  it.each([
    ['the server fails', { ok: false, status: 500, error: 'Internal Server Error' }],
    ['the network is down', { ok: false, status: 0, error: 'Network error' }],
  ])('tries twice more, then answers with nothing and without a toast, when %s', async (_, response) => {
    spies.get.mockResolvedValue(response);
    mount();

    await until(() => expect(queryClient.getQueryState(QUERY_KEY)?.status).toBe('error'));
    expect(spies.get).toHaveBeenCalledTimes(3);
    expect(container.textContent).toBe('none');
    expect(spies.toast).not.toHaveBeenCalled();
  });

  it('still answers with the key when a retry after a blip gets it', async () => {
    spies.get.mockResolvedValueOnce({ ok: false, status: 503, error: 'Service Unavailable' }).mockResolvedValue(SERVED);
    mount();

    await until(() => expect(container.textContent).toBe('log-1'));
    expect(spies.get).toHaveBeenCalledTimes(2);
  });
});
