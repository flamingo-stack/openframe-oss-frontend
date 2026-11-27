/**
 * The Incidents page and a device's Incidents tab read one page per request, the cursor in the URL. `insights` pages
 * forward only (`first` / `after`). Over the real tables, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range over the facets' `filteredCount` (`insights` has no count)
 * - the URL's cursor is sent as `after`, and labels the range with the URL's page
 * - the device tab reads its keys under its prefix (`incidentsCursor`, `incidentsSearch`), never the page's own
 * - a new search drops the cursor in the same URL write
 * - a transition reads the page on screen again (its cursor, one page), and Archive Resolved marks the list changed
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
// The agents' marks are drawn from their server identities, provided at the app's root: a stand-in here.
vi.mock('@flamingo-stack/openframe-frontend-core/components', async importOriginal => ({
  ...(await importOriginal<object>()),
  AgentMark: () => <span data-mingo-mark />,
}));
// A row's ⋯ menu opens on pointer events jsdom does not dispatch: here, its items as plain buttons.
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ActionsMenuDropdown: ({ groups }: { groups: { items: { id: string; label: string; onClick?: () => void }[] }[] }) => (
    <>
      {groups
        .flatMap(group => group.items)
        .map(item => (
          <button key={item.id} onClick={item.onClick}>
            {item.label}
          </button>
        ))}
    </>
  ),
}));
// The confirm dialog: a button that confirms, drawn while the dialog is open.
vi.mock('@/app/components/shared/confirm-dialog', () => ({
  ConfirmDialog: ({ open, confirmLabel, onConfirm }: { open: boolean; confirmLabel: string; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>{confirmLabel}</button> : null,
}));
// What a row's Mingo button, its chat and its assignee picker read is not these tests': stand-ins with stable answers.
vi.mock('./hooks/use-fix-with-mingo', () => {
  const controls = {};
  const action = { label: 'Fix with Mingo', onClick: () => undefined, disabled: false, loading: false };
  return { useFixWithMingo: () => controls, mingoActionFor: () => action };
});
vi.mock('./hooks/use-incident-dialogs', () => {
  const sessions = {};
  return { useLatestIncidentDialogs: () => sessions };
});
vi.mock('./components/incident-assignee', () => ({ IncidentAssignee: () => <span>Unassigned</span> }));
vi.mock('./components/snooze-incident-modal', () => ({ SnoozeIncidentModal: () => null }));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/incidentsTableQuery.graphql'),
    import('@/__generated__/insightRowFields_insight.graphql'),
    import('@/__generated__/insightFacets_filters.graphql'),
    import('@/__generated__/insightTransitions_query.graphql'),
    import('@/__generated__/userSummaryFields_user.graphql'),
    import('@/__generated__/archiveResolvedInsightsMutation.graphql'),
    import('@/__generated__/acknowledgeInsightMutation.graphql'),
    import('@/__generated__/resolveInsightMutation.graphql'),
    import('@/__generated__/archiveInsightMutation.graphql'),
    import('@/__generated__/reopenInsightMutation.graphql'),
    import('@/__generated__/snoozeInsightMutation.graphql'),
  ]);
  const names = [
    'incidentsTableQuery',
    'insightRowFields_insight',
    'insightFacets_filters',
    'insightTransitions_query',
    'userSummaryFields_user',
    'archiveResolvedInsightsMutation',
    'acknowledgeInsightMutation',
    'resolveInsightMutation',
    'archiveInsightMutation',
    'reopenInsightMutation',
    'snoozeInsightMutation',
  ];
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

import { DeviceIncidentsTable, IncidentsTable } from './components/incidents-table';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: false, hasPreviousPage: false };

const incident = (id: string, title: string) => ({
  id,
  title,
  type: 'DISK_SPACE',
  severity: 'HIGH',
  status: 'ACKNOWLEDGED',
  snoozedUntil: null,
  detectedAt: '2026-11-18T10:15:00Z',
  machineId: 'm-1',
  machine: { id: 'machine-1', hostname: 'reception-01', displayName: null, nickname: null, type: 'DESKTOP' },
  organizationId: 'org-1',
  organization: { id: 'organization-1', name: 'Acme Logistics' },
  assigneeId: null,
  assignee: null,
  unreadNotificationCount: 0,
});

const facet = (value: string, count: number) => [{ value, label: value, count }];

const PAGE = {
  insights: {
    edges: [
      { node: incident('insight-1', 'Disk almost full') },
      { node: incident('insight-2', 'Disk almost full again') },
    ],
    pageInfo: PAGE_INFO,
  },
  insightFilters: {
    types: facet('DISK_SPACE', 42),
    severities: facet('HIGH', 42),
    statuses: facet('ACKNOWLEDGED', 42),
    organizationIds: [{ value: 'org-1', label: 'Acme Logistics', count: 42 }],
    assigneeIds: [],
    filteredCount: 42,
  },
  insightStatusTransitions: [{ from: 'ACKNOWLEDGED', to: ['RESOLVED'] }],
};

/** What the fake server answers, by operation. */
const ANSWERS: Record<string, unknown> = {
  incidentsTableQuery: PAGE,
  resolveInsightMutation: { resolveInsight: { id: 'insight-1', status: 'RESOLVED', snoozedUntil: null } },
  archiveResolvedInsightsMutation: { archiveResolvedInsights: 3 },
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
      return { data: ANSWERS[request.name] as never };
    }),
    store: new Store(new RecordSource()),
  });
  act(() => root.render(<RelayEnvironmentProvider environment={environment}>{element}</RelayEnvironmentProvider>));
  await settle();
}

/** The page's URL, as the browser shows it. */
const openAt = (path: string, search = '') => window.history.replaceState(null, '', `${path}${search}`);
const reads = (name: string) => requests.filter(request => request.name === name);
const pagerRow = () => container.querySelector('[data-table-meta]')?.textContent ?? '';
const urlParams = () => new URLSearchParams(window.location.search);
/**
 * The query of every history entry the page pushed while `run` ran. The library's navigation shim writes the URL with
 * `history.pushState` / `replaceState`; a search change is ONE push that already has no cursor (the pager's own safety
 * net would drop a cursor left behind, but in a second write, after an entry that pairs the new search with the old
 * cursor).
 */
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
const buttons = (label: string) =>
  [...document.querySelectorAll('button')].filter(
    element => element.getAttribute('aria-label') === label || element.textContent === label,
  );
/** Types into the search box as a person does, then waits out its debounce into the URL. */
async function typeSearch(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Search for Incidents"]');
  expect(input).toBeTruthy();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(400);
}

/** jsdom has no `ResizeObserver`, and the list measures its sticky toolbar with one: an observer that never fires. */
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => vi.stubGlobal('ResizeObserver', IdleResizeObserver));
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  stubLayoutApis();
  answerTableFlag('off');
  openAt('/incidents');
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

describe('the Incidents page', () => {
  const page = () => <IncidentsTable tab="current" />;

  it("reads the first page and puts its range over the facets' total in the row above the table", async () => {
    await render(page());

    expect(container.textContent).toContain('Disk almost full');
    expect(reads('incidentsTableQuery')[0]?.variables).toMatchObject({ first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("sends the URL's cursor as after and labels the range with the URL's page", async () => {
    openAt('/incidents', '?cursor=c-40&page=3');
    await render(page());

    expect(reads('incidentsTableQuery')[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops the cursor in the same URL write that carries a new search (one history entry)', async () => {
    openAt('/incidents', '?cursor=c-40&page=3');
    await render(page());

    const pushed = await pushedWhile(() => typeSearch('disk'));

    expect(pushed.map(params => params.toString())).toEqual(['search=disk']);
    expect(urlParams().toString()).toBe('search=disk');
    expect(reads('incidentsTableQuery').at(-1)?.variables).toMatchObject({ search: 'disk', first: 20, after: null });
  });

  it('reads the page on screen again after a transition: its cursor, one page', async () => {
    openAt('/incidents', '?cursor=c-40&page=3');
    await render(page());
    const before = reads('incidentsTableQuery').length;

    await click(buttons('Resolve')[0]);

    expect(reads('resolveInsightMutation')).toHaveLength(1);
    expect(reads('resolveInsightMutation')[0]?.variables).toEqual({ input: { id: 'insight-1' } });
    expect(reads('incidentsTableQuery')).toHaveLength(before + 1);
    expect(reads('incidentsTableQuery').at(-1)?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('reads its page again after Archive Resolved (the list is marked changed)', async () => {
    openAt('/incidents', '?cursor=c-40&page=3');
    await render(page());
    const before = reads('incidentsTableQuery').length;

    await click(buttons('Archive Resolved')[0]);
    await click(buttons('Archive Resolved').at(-1));

    expect(reads('archiveResolvedInsightsMutation')).toHaveLength(1);
    expect(reads('incidentsTableQuery')).toHaveLength(before + 1);
    expect(reads('incidentsTableQuery').at(-1)?.variables).toMatchObject({ first: 20, after: 'c-40' });
  });
});

describe("a device's Incidents tab", () => {
  const PATH = '/devices/details';
  const tab = () => <DeviceIncidentsTable machineId="m-1" emptyState={<div data-no-incidents />} />;

  it("reads its keys under the tab's prefix, never the page's own", async () => {
    openAt(PATH, '?id=dev-1&cursor=c-other&search=other&incidentsCursor=c-40&incidentsPage=3&incidentsSearch=disk');
    await render(tab());

    const [first] = reads('incidentsTableQuery');
    expect(first?.variables).toMatchObject({ search: 'disk', first: 20, after: 'c-40' });
    expect(first?.variables.filter).toMatchObject({ machineIds: ['m-1'] });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it("drops only its own cursor in the URL write that carries a new search, leaving the page's params", async () => {
    openAt(PATH, '?id=dev-1&cursor=c-other&search=other&incidentsCursor=c-40&incidentsPage=3');
    await render(tab());

    const pushed = await pushedWhile(() => typeSearch('cpu'));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({
      id: 'dev-1',
      cursor: 'c-other',
      search: 'other',
      incidentsSearch: 'cpu',
    });
    expect(reads('incidentsTableQuery').at(-1)?.variables).toMatchObject({ search: 'cpu', after: null });
  });
});
