/**
 * The logs table reads one page per request, the cursor in the URL: on the Logs page, in a customer's Logs tab and in
 * a device's Overview. `logs` accepts `before` but answers the NEXT page to it, so the table pages forward only and
 * never sends `before` / `last`. Over the real table, the lib's views, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range, with no total ("21–40 logs": logs carry none)
 * - the URL's cursor is sent as `after`, and labels the range with the URL's page; `before` / `last` never go out
 * - Refresh on a later page drops the cursor and reads the first page (never page 1's rows under "41–60"); on the
 *   first page it reads that page again
 * - in a customer's or a device's tab the table reads its keys under `logs…` (`logsSearch`, `logsCursor`), never the
 *   page's own `search` / `cursor`, and a new search drops only its own cursor in the same URL write
 */

import { act, createRef, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerTableFlag, stubLayoutApis } from '@/app/hooks/use-table-layout.fixtures';

const router = vi.hoisted(() => ({ push: () => {}, replace: () => {}, back: () => {} }));

// The page's own router. The core library's hooks (the URL params, the pager, the auto-refresh) read and write the
// document's location through the library's navigation shim, so a test puts the URL there (`openAt`) and reads it back.
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));
// The drawer's details and its device card read their own data: not what these tests are about.
vi.mock('./components/log-drawer-details', () => ({ LogDrawerDetails: () => null }));
vi.mock('@/app/components/shared/log-drawer-device-card', () => ({ logDrawerDeviceCard: () => null }));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/logsTableRelayQuery.graphql'),
    import('@/__generated__/logCopyButton_log.graphql'),
    import('@/__generated__/logCopyButtonQuery.graphql'),
  ]);
  const names = ['logsTableRelayQuery', 'logCopyButton_log', 'logCopyButtonQuery'];
  const artifacts = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return {
    // CommonJS: the provider is only on `default`.
    ...actual.default,
    ...actual,
    graphql: (strings: TemplateStringsArray) => {
      const name = /(?:fragment|query|mutation)\s+(\w+)/.exec(strings.join(''))?.[1] ?? '';
      return artifacts[name] ?? {};
    },
  };
});

import { LogsTable, type LogsTableRef } from './components/logs-table';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: true, hasPreviousPage: false };

const log = (id: string, summary: string) => ({
  id,
  toolEventId: `evt-${id}`,
  eventType: 'login',
  ingestDay: '2026-11-18',
  toolType: 'FLEET_MDM',
  severity: 'INFO',
  deviceId: 'm-1',
  hostname: 'reception-01',
  nickname: null,
  organizationId: 'org-1',
  organizationName: 'Acme Logistics',
  summary,
  timestamp: '2026-11-18T10:15:00Z',
});

const PAGE = {
  logs: {
    edges: [{ node: log('log-1', 'Sign-in from the office network') }, { node: log('log-2', 'Script finished') }],
    pageInfo: PAGE_INFO,
  },
  logFilters: { toolTypes: ['FLEET_MDM'], severities: ['INFO'], organizations: [{ id: 'org-1', name: 'Acme' }] },
};

interface SeenRequest {
  name: string;
  variables: Record<string, unknown>;
}

/** The operations the environment was asked for, in order, with their variables. */
let requests: SeenRequest[] = [];
let container: HTMLDivElement;
let root: Root;

const settle = async (ms = 10) => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
};

async function render(element: ReactElement) {
  const environment = new Environment({
    network: Network.create(async (request, variables) => {
      requests.push({ name: request.name, variables });
      return { data: (request.name === 'logsTableRelayQuery' ? PAGE : {}) as never };
    }),
    store: new Store(new RecordSource()),
  });
  act(() => root.render(<RelayEnvironmentProvider environment={environment}>{element}</RelayEnvironmentProvider>));
  await settle();
}

/** The page's URL, as the browser shows it. */
const openAt = (path: string, search = '') => window.history.replaceState(null, '', `${path}${search}`);
const reads = () => requests.filter(request => request.name === 'logsTableRelayQuery');
const pagerRow = () => container.querySelector('[data-table-meta]')?.textContent ?? '';
const urlParams = () => new URLSearchParams(window.location.search);
/** The query of every history entry the page pushed while `run` ran (the navigation shim's `pushState`). */
async function pushedWhile(run: () => Promise<void>): Promise<URLSearchParams[]> {
  const pushState = vi.spyOn(window.history, 'pushState');
  try {
    await run();
    return pushState.mock.calls.map(([, , url]) => new URL(String(url), window.location.href).searchParams);
  } finally {
    pushState.mockRestore();
  }
}
const click = async (element: Element | null | undefined) => {
  expect(element).toBeTruthy();
  act(() => (element as HTMLElement).click());
  await settle();
};
const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    element => element.getAttribute('aria-label') === label || element.textContent === label,
  );
/** Types into the search box as a person does, then waits out its debounce into the URL. */
async function typeSearch(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Search for Logs"]');
  expect(input).toBeTruthy();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(400);
}
/** No read asks for a page backward: `before` would answer the NEXT page here. */
function expectForwardOnly() {
  for (const { variables } of reads()) {
    expect(variables).not.toHaveProperty('before');
    expect(variables).not.toHaveProperty('last');
  }
}

beforeEach(() => {
  stubLayoutApis();
  answerTableFlag('off');
  openAt('/logs-page');
  requests = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  answerTableFlag('loading');
});

describe('the Logs page', () => {
  it('reads the first page forward and puts its range, with no total, in the row above the table', async () => {
    await render(<LogsTable />);

    expect(container.textContent).toContain('Sign-in from the office network');
    expect(reads()[0]?.variables).toMatchObject({ first: 20, after: null });
    expectForwardOnly();
    expect(pagerRow()).toContain('1–2 logs');
  });

  it("sends the URL's cursor as after, never before or last, and labels the range with the URL's page", async () => {
    openAt('/logs-page', '?cursor=c-40&page=3');
    await render(<LogsTable />);

    expect(reads()[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expectForwardOnly();
    expect(pagerRow()).toContain('41–42 logs');
  });

  it('Refresh on a later page drops the cursor and reads the first page', async () => {
    openAt('/logs-page', '?cursor=c-40&page=3');
    await render(<LogsTable />);

    await click(button('Refresh'));

    expect(urlParams().has('cursor')).toBe(false);
    expect(urlParams().has('page')).toBe(false);
    expect(reads().at(-1)?.variables).toMatchObject({ first: 20, after: null });
    expectForwardOnly();
    expect(pagerRow()).toContain('1–2 logs');
  });

  it('Refresh on the first page reads that page again from the network', async () => {
    await render(<LogsTable />);
    const before = reads().length;

    await click(button('Refresh'));

    expect(reads()).toHaveLength(before + 1);
    expect(reads().at(-1)?.variables).toMatchObject({ first: 20, after: null });
    expect(pagerRow()).toContain('1–2 logs');
  });

  it('drops the cursor in the same URL write that carries a new search (one history entry)', async () => {
    openAt('/logs-page', '?cursor=c-40&page=3');
    await render(<LogsTable />);

    const pushed = await pushedWhile(() => typeSearch('vpn'));

    expect(pushed.map(params => params.toString())).toEqual(['search=vpn']);
    expect(reads().at(-1)?.variables).toMatchObject({ search: 'vpn', first: 20, after: null });
  });
});

describe("a customer's Logs tab", () => {
  const PATH = '/customers/details';
  const tab = () => <LogsTable organizationId="org-1" embedded />;

  it("reads logsSearch and logsCursor, never the page's own search and cursor", async () => {
    openAt(PATH, '?id=org-1&tab=logs&search=other&cursor=c-other&logsSearch=vpn&logsCursor=c-40&logsPage=3');
    await render(tab());

    const [first] = reads();
    expect(first?.variables).toMatchObject({ search: 'vpn', first: 20, after: 'c-40' });
    expect(first?.variables.filter).toMatchObject({ organizationIds: ['org-1'] });
    expectForwardOnly();
    expect(pagerRow()).toContain('41–42 logs');
  });

  it("writes a new search to logsSearch and drops only logsCursor, leaving the page's params", async () => {
    openAt(PATH, '?id=org-1&tab=logs&search=other&cursor=c-other&logsCursor=c-40&logsPage=3');
    await render(tab());

    const pushed = await pushedWhile(() => typeSearch('dns'));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({
      id: 'org-1',
      tab: 'logs',
      search: 'other',
      cursor: 'c-other',
      logsSearch: 'dns',
    });
    expect(reads().at(-1)?.variables).toMatchObject({ search: 'dns', after: null });
  });
});

describe("a device's Overview", () => {
  const PATH = '/devices/details';

  it('reads logsCursor, and its refresh (a script run) drops only that cursor and reads the first page', async () => {
    openAt(PATH, '?id=dev-1&cursor=c-other&logsCursor=c-40&logsPage=3&refresh=1700000000000');
    const ref = createRef<LogsTableRef>();
    await render(<LogsTable ref={ref} deviceId="m-1" deviceScoped showHeader={false} />);

    expect(reads()[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(reads()[0]?.variables.filter).toMatchObject({ deviceId: 'm-1' });
    expect(pagerRow()).toContain('41–42 logs');

    act(() => ref.current?.refresh());
    await settle();

    expect(Object.fromEntries(urlParams())).toEqual({ id: 'dev-1', cursor: 'c-other', refresh: '1700000000000' });
    expect(reads().at(-1)?.variables).toMatchObject({ first: 20, after: null });
    expectForwardOnly();
    expect(pagerRow()).toContain('1–2 logs');
  });
});
