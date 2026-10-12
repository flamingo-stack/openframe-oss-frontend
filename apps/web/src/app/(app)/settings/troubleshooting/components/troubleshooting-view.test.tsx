/**
 * The Troubleshooting page against a stubbed Relay layer: what the URL says is
 * what `deviceLogs` is asked for. No device = the whole tenant (`machineIds`
 * null, never `[]`); picked devices and levels reach the variables; the
 * customer filter follows its flag; an empty answer with something narrowed
 * offers Reset, and Reset writes every param in one URL update. A pick reaches
 * the controls at once and the query once the picks settle, both before the URL
 * does; the list shows the query in flight instead of holding the click, and
 * does not page its old rows meanwhile. Each assertion was verified to fail with
 * its guard removed.
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
import { DEVICE_LOG_LIST_DEBOUNCE_MS } from '@/app/(app)/devices/hooks/use-deferred-log-list';
import { DEVICE_LOG_SEARCH_DEBOUNCE_MS } from '@/app/(app)/devices/hooks/use-device-log-filters';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { TroubleshootingView } from './troubleshooting-view';

const spies = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  lazyLoadQuery: vi.fn<(node: unknown, variables: Record<string, unknown>) => unknown>(),
  fetchDevicesPage: vi.fn(),
  loadNext: vi.fn(),
  page: { edges: [] as unknown[], hasNext: false },
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
// of; the hooks are stubbed to answer `spies.page` (an empty first page by default).
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useRelayEnvironment: () => ({}),
  useLazyLoadQuery: (node: unknown, variables: Record<string, unknown>) => spies.lazyLoadQuery(node, variables),
  usePaginationFragment: () => ({
    data: { deviceLogs: { edges: spies.page.edges } },
    loadNext: spies.loadNext,
    hasNext: spies.page.hasNext,
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

/** The sentinels being watched right now: a disconnected observer can no longer fire. */
const observing = new Set<IntersectionObserverStub>();
class IntersectionObserverStub {
  private readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(): void {
    observing.add(this);
  }
  unobserve(): void {}
  disconnect(): void {
    observing.delete(this);
  }
  /** The sentinel scrolled into view. */
  intersect(): void {
    const entry = { isIntersecting: true, boundingClientRect: { top: 0 }, rootBounds: { bottom: 100 } };
    this.callback([entry as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
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

function levelChip(level: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
    element => element.textContent?.trim() === level,
  );
}

function refreshButton() {
  return Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Refresh');
}

function searchInput() {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search device logs"]');
  if (!input) throw new Error('no search box');
  return input;
}

/** A keystroke as React sees it: the native setter, then the event its onChange listens to. */
function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** What the list's live region says to a screen reader. */
function listStatus() {
  return Array.from(container.querySelectorAll('[role="status"]'))
    .map(element => element.textContent ?? '')
    .find(text => text.startsWith('Loading logs'));
}

function logEdge(cursor: string) {
  return {
    cursor,
    node: {
      timestamp: '2026-10-09T12:00:00Z',
      agentTimestamp: null,
      level: 'ERROR',
      message: 'disk full',
      machineId: 'm-1',
      hostname: 'host-1',
      count: 1,
    },
  };
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(DEVICE_LOG_LIST_DEBOUNCE_MS);
  });
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
  spies.loadNext.mockReset();
  spies.page = { edges: [], hasNext: false };
  observing.clear();
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

  it('repaints a level chip on the click, and asks for its lines once the picks settle', async () => {
    await mount('');
    const chip = levelChip('ERROR');
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      chip?.click();
    });
    // The URL is still the old one (the mocked router never lands a write): the chip follows the intent anyway.
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
    expect(spies.replace).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(spies.replace.mock.calls[0][0].split('?')[1] ?? '').getAll('logLevels')).toEqual([
      'DEBUG',
      'INFO',
      'WARN',
    ]);
    // The request waits out the debounce, then follows the intent too.
    expect(lastVariables().filter.levels).toBeUndefined();
    await settle();
    expect(lastVariables().filter.levels).toEqual(['DEBUG', 'INFO', 'WARN']);
  });

  it('asks once for a run of picks, with the last of them', async () => {
    await mount('');
    await act(async () => {
      levelChip('ERROR')?.click();
    });
    await act(async () => {
      levelChip('WARN')?.click();
    });
    await settle();
    const asked = spies.lazyLoadQuery.mock.calls.map(
      ([, variables]) => (variables.filter as { levels?: string[] }).levels,
    );
    // The first pick never became a request of its own; the second composed with it.
    expect(asked).not.toContainEqual(['DEBUG', 'INFO', 'WARN']);
    expect(asked.at(-1)).toEqual(['DEBUG', 'INFO']);
  });

  it('writes the search once the typing stops, not at a pause between words, and asks for it once', async () => {
    await mount('');
    const type = async (values: string[], gapMs: number) => {
      for (const value of values) {
        await act(async () => {
          typeInto(searchInput(), value);
          vi.advanceTimersByTime(gapMs);
        });
      }
    };
    // A word, then the kind of pause that comes before the next one.
    await type(['d', 'di', 'dis', 'disk'], 100);
    await act(async () => {
      vi.advanceTimersByTime(300 - 100);
    });
    expect(searchInput().value).toBe('disk');
    expect(spies.replace).not.toHaveBeenCalled();

    await type(['disk ', 'disk f', 'disk fu', 'disk ful', 'disk full'], 100);
    await act(async () => {
      vi.advanceTimersByTime(DEVICE_LOG_SEARCH_DEBOUNCE_MS - 100);
    });
    expect(spies.replace).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(spies.replace.mock.calls[0][0].split('?')[1] ?? '').get('logSearch')).toBe('disk full');

    await settle();
    const searched = spies.lazyLoadQuery.mock.calls
      .map(([, variables]) => (variables.filter as { contains?: string[] }).contains)
      .filter(contains => contains !== undefined);
    expect(new Set(searched.map(contains => contains.join(' ')))).toEqual(new Set(['disk full']));
  });

  it('does not page the old list while the next one is on its way', async () => {
    spies.page = { edges: [logEdge('c-1')], hasNext: true };
    await mount('');
    await act(async () => {
      for (const observer of observing) observer.intersect();
    });
    // The wiring: at the bottom of a settled list, the older page is asked for.
    expect(spies.loadNext).toHaveBeenCalledTimes(1);

    spies.loadNext.mockClear();
    await act(async () => {
      levelChip('ERROR')?.click();
    });
    await act(async () => {
      for (const observer of observing) observer.intersect();
    });
    expect(spies.loadNext).not.toHaveBeenCalled();
  });

  it('keeps the list on screen as loading while the picked lines are in flight', async () => {
    await mount('');
    let release = () => {};
    const inFlight = new Promise<void>(resolve => {
      release = resolve;
    });
    let answered = false;
    spies.lazyLoadQuery.mockImplementation((_node, variables) => {
      const { levels } = variables.filter as { levels?: string[] };
      if (levels && !answered) throw inFlight;
      return {};
    });

    await act(async () => {
      levelChip('ERROR')?.click();
    });
    // The click is not held by the query: the chip shows it, and the list in place of its empty
    // state shows it is loading, through the debounce and the request alike, with Refresh off.
    expect(levelChip('ERROR')?.getAttribute('aria-pressed')).toBe('false');
    expect(container.textContent).not.toContain('No logs in this range');
    expect(listStatus()).toBe('Loading logs…');
    expect(refreshButton()?.disabled).toBe(true);

    await settle();
    expect(lastVariables().filter.levels).toEqual(['DEBUG', 'INFO', 'WARN']);
    expect(listStatus()).toBe('Loading logs…');
    expect(refreshButton()?.disabled).toBe(true);

    await act(async () => {
      answered = true;
      release();
      await inFlight;
    });
    expect(container.textContent).toContain('No logs in this range');
    expect(listStatus()).toBeUndefined();
    expect(refreshButton()?.disabled).toBe(false);
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
