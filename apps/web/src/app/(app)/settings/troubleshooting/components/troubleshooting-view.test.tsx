/**
 * The Troubleshooting page against a stubbed Relay layer: what the URL says is
 * what `deviceLogs` is asked for. No device = the whole tenant (`machineIds`
 * null, never `[]`); picked devices and levels reach the variables; an empty
 * answer with something narrowed offers Reset, and Reset writes every param
 * in one URL update. Each assertion was verified to fail with its guard removed.
 */

import { type NavigationImpl, registerNavigation } from '@flamingo-stack/openframe-frontend-core/embed-shims';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  notFound,
  permanentRedirect,
  redirect,
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TroubleshootingView } from './troubleshooting-view';

const spies = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  lazyLoadQuery: vi.fn<(node: unknown, variables: Record<string, unknown>) => unknown>(),
  fetchDevicesPage: vi.fn(),
}));

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: spies.replace, back: vi.fn() }),
  usePathname: () => '/settings/troubleshooting',
  useSearchParams: () => searchParams,
  useParams: () => ({}),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
}));

// The core lib reads the router through its embed shims, which the app registers at
// boot (`register-embed-shims.ts`); here they get the same mocked hooks.
registerNavigation({
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
  redirect,
  permanentRedirect,
  notFound,
} as NavigationImpl);

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() }, REQUEST_TIMEOUT_MS: 30_000 }));
vi.mock('@/app/(app)/devices/queries/devices-api', () => ({ fetchDevicesPage: spies.fetchDevicesPage }));
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => true }));

// The list's `graphql` tags need the Relay transform, which vitest has no equivalent
// of; the hooks are stubbed to answer an empty first page.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useRelayEnvironment: () => ({}),
  useLazyLoadQuery: (node: unknown, variables: Record<string, unknown>) => spies.lazyLoadQuery(node, variables),
  usePaginationFragment: () => ({
    data: { deviceLogs: { edges: [] } },
    loadNext: vi.fn(),
    hasNext: false,
    isLoadingNext: false,
  }),
  useFragment: (_node: unknown, ref: unknown) => ref,
  fetchQuery: () => ({ subscribe: () => ({ unsubscribe: vi.fn() }) }),
}));

class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
window.matchMedia ??= () =>
  ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList;

let container: HTMLDivElement;
let root: Root;

async function mount(query: string) {
  searchParams = new URLSearchParams(query);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TroubleshootingView />
      </QueryClientProvider>,
    );
  });
}

function lastVariables() {
  const call = spies.lazyLoadQuery.mock.calls.at(-1);
  if (!call) throw new Error('deviceLogs was never asked for');
  return call[1] as { machineIds: string[] | null; filter: { levels?: string[]; from?: string } };
}

beforeEach(() => {
  vi.useFakeTimers();
  spies.replace.mockReset();
  spies.lazyLoadQuery.mockReset().mockReturnValue({});
  spies.fetchDevicesPage.mockReset().mockResolvedValue({
    devices: [],
    pageInfo: { hasNextPage: false },
    filteredCount: 0,
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

describe('TroubleshootingView', () => {
  it('asks for the whole tenant when no device is picked', async () => {
    await mount('');
    const variables = lastVariables();
    expect(variables.machineIds).toBeNull();
    expect(variables.filter.levels).toBeUndefined();
    expect(variables.filter.from).toEqual(expect.any(String));
    expect(container.textContent).toContain('No logs in this range');
    expect(container.textContent).not.toContain('Reset filters');
  });

  it('sends the picked devices and levels from the URL', async () => {
    await mount('device=m-1&device=m-2&device=m-1&logLevels=ERROR&logLevels=WARN');
    const variables = lastVariables();
    expect(variables.machineIds).toEqual(['m-1', 'm-2']);
    expect(variables.filter.levels).toEqual(['ERROR', 'WARN']);
    expect(container.textContent).toContain('Reset filters');
  });

  it('resets the devices and the log params in one URL write', async () => {
    await mount('device=m-1&logLevels=ERROR&logRange=7d');
    const reset = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Reset filters',
    );
    expect(reset).toBeDefined();
    await act(async () => {
      reset?.click();
    });
    expect(spies.replace).toHaveBeenCalledTimes(1);
    const [href] = spies.replace.mock.calls[0];
    const written = new URLSearchParams(href.split('?')[1] ?? '');
    expect(written.getAll('device')).toEqual([]);
    expect(written.getAll('logLevels')).toEqual([]);
    expect(written.get('logRange')).toBeNull();
  });
});
