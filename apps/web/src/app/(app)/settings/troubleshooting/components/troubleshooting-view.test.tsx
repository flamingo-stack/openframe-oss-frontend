/**
 * The Troubleshooting page against a stubbed Relay layer: what the URL says is
 * what `deviceLogs` is asked for. No device = the whole tenant (`machineIds`
 * null, never `[]`); picked devices and levels reach the variables; the
 * customer filter follows its flag; an empty answer with something narrowed
 * offers Reset, and Reset writes every param in one URL update. Each assertion
 * was verified to fail with its guard removed.
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
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
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
vi.mock('@/lib/api-client', () => ({
  // The customer picker lists organizations through the api client; an empty page keeps it quiet.
  apiClient: {
    post: vi.fn(async () => ({ ok: true, data: { data: { organizations: { edges: [] } } } })),
    get: vi.fn(),
  },
  REQUEST_TIMEOUT_MS: 30_000,
}));
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
  return call[1] as {
    machineIds: string[] | null;
    organizationIds: string[] | null;
    filter: { levels?: string[]; from?: string };
  };
}

function flags(enabled: boolean) {
  useFeatureFlagsStore.getState().setFlags([{ name: 'device-logs-customer-filter', enabled }]);
}

beforeEach(() => {
  vi.useFakeTimers();
  useFeatureFlagsStore.getState().reset();
  flags(false);
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
  it('asks for the whole tenant over the last hour when nothing is picked', async () => {
    await mount('');
    const variables = lastVariables();
    expect(variables.machineIds).toBeNull();
    expect(variables.organizationIds).toBeNull();
    expect(variables.filter.levels).toBeUndefined();
    // The page opens on the last hour, not the device tab's day.
    const from = Date.parse(variables.filter.from ?? '');
    expect(Math.abs(Date.now() - from - 60 * 60 * 1000)).toBeLessThan(5_000);
    expect(container.textContent).toContain('Last hour');
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

  it('sends the picked customers once the flag is on, and ignores them while it is off', async () => {
    flags(true);
    await mount('customer=org-1&customer=org-2&device=m-1');
    expect(lastVariables().organizationIds).toEqual(['org-1', 'org-2']);
    expect(lastVariables().machineIds).toEqual(['m-1']);
    // The picker is on the page, with the picked customers as its chips.
    expect(container.textContent).toContain('org-1');

    await act(async () => {
      root.unmount();
    });
    flags(false);
    await mount('customer=org-1');
    expect(lastVariables().organizationIds).toBeNull();
    expect(container.textContent).not.toContain('org-1');
  });

  it('repaints a level chip on the click, before the URL round trip lands', async () => {
    await mount('');
    const chip = Array.from(container.querySelectorAll('[role="button"]')).find(
      element => element.textContent?.trim() === 'ERROR',
    ) as HTMLElement | undefined;
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      chip?.click();
    });
    // The URL is still the old one (the mocked router never lands a write): the chip shows the intent anyway.
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
    expect(lastVariables().filter.levels).toBeUndefined();
    expect(spies.replace).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(spies.replace.mock.calls[0][0].split('?')[1] ?? '').getAll('logLevels')).toEqual([
      'DEBUG',
      'INFO',
      'WARN',
    ]);
  });

  it('resets the customers, the devices and the log params in one URL write', async () => {
    flags(true);
    await mount('customer=org-1&device=m-1&logLevels=ERROR&logRange=7d');
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
    expect(written.getAll('customer')).toEqual([]);
    expect(written.getAll('device')).toEqual([]);
    expect(written.getAll('logLevels')).toEqual([]);
    expect(written.get('logRange')).toBeNull();
  });
});
