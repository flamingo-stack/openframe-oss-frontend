/**
 * The scripts and schedules list pages (and their archives) read one page per request, the cursor in the URL, and
 * page back on the server. Over the real pages, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range over the server's total
 * - a cursor read backward (`dir=before`) is sent as `last` / `before`: these lists page back on the server
 * - an unarchive marks the list changed and the page is read again (a paged list has no connection to edit)
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerTableFlag, stubLayoutApis } from '@/app/hooks/use-table-layout.fixtures';

const router = vi.hoisted(() => ({ push: () => {}, replace: () => {}, back: () => {} }));

// The page's own router. The core library's hooks (the URL params, the pager, the auto-refresh) read the document's
// location through the library's navigation shim, so a test puts the URL there (`openAt`).
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));
// The toolbar's tag filter and the header's Mingo action read their own data: not what these tests are about.
vi.mock('./script/components/scripts-tag-filter', () => ({ ScriptsTagFilter: () => null }));
vi.mock('@/app/(app)/mingo/hooks/use-generate-with-ai-action', () => ({ useGenerateWithAiAction: () => undefined }));
// The confirm dialogs: a button that confirms, drawn while the dialog is open.
vi.mock('./script/components/restore-script-modal', () => ({
  RestoreScriptModal: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm restore</button> : null,
}));
vi.mock('./schedule/components/restore-schedule-modal', () => ({
  RestoreScheduleModal: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>Confirm restore</button> : null,
}));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/scriptsTableQuery.graphql'),
    import('@/__generated__/scriptSchedulesTableQuery.graphql'),
    import('@/__generated__/userSummaryFields_user.graphql'),
    import('@/__generated__/facetOptions_entry.graphql'),
    import('@/__generated__/useScriptArchiveArchiveMutation.graphql'),
    import('@/__generated__/useScriptArchiveUnarchiveMutation.graphql'),
    import('@/__generated__/useScheduleArchiveArchiveMutation.graphql'),
    import('@/__generated__/useScheduleArchiveUnarchiveMutation.graphql'),
    import('@/__generated__/scriptFiltersRefreshRelayQuery.graphql'),
    import('@/__generated__/scriptScheduleFiltersRefreshRelayQuery.graphql'),
    import('@/__generated__/scriptTagsRelayFilterQuery.graphql'),
  ]);
  const names = [
    'scriptsTableQuery',
    'scriptSchedulesTableQuery',
    'userSummaryFields_user',
    'facetOptions_entry',
    'useScriptArchiveArchiveMutation',
    'useScriptArchiveUnarchiveMutation',
    'useScheduleArchiveArchiveMutation',
    'useScheduleArchiveUnarchiveMutation',
    'scriptFiltersRefreshRelayQuery',
    'scriptScheduleFiltersRefreshRelayQuery',
    'scriptTagsRelayFilterQuery',
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

import { ScriptSchedulesTable } from './schedule/components/script-schedules-table';
import { ScriptsTable } from './script/components/scripts-table';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: false, hasPreviousPage: false };

const AUTHOR = {
  id: 'user-1',
  firstName: 'Maya',
  lastName: 'Chen',
  email: 'maya@acme.io',
  status: 'ACTIVE',
  image: null,
};

const SCRIPTS = {
  scripts: {
    filteredCount: 42,
    edges: [
      {
        node: {
          id: 'script-1',
          name: 'Clear temp files',
          description: 'Frees disk space',
          shell: 'BASH',
          supportedPlatforms: ['LINUX'],
          defaultTimeoutSeconds: 300,
          author: AUTHOR,
        },
      },
      {
        node: {
          id: 'script-2',
          name: 'Restart spooler',
          description: null,
          shell: 'POWERSHELL',
          supportedPlatforms: ['WINDOWS'],
          defaultTimeoutSeconds: null,
          author: null,
        },
      },
    ],
    pageInfo: PAGE_INFO,
  },
  scriptFilters: {
    shells: [{ value: 'BASH', label: 'Bash', count: 1 }],
    platforms: [{ value: 'LINUX', label: 'Linux', count: 1 }],
    authors: [{ value: 'user-1', label: 'Maya Chen', count: 1 }],
  },
};

const SCHEDULES = {
  scriptSchedules: {
    filteredCount: 42,
    edges: [
      {
        node: {
          id: 'schedule-1',
          name: 'Nightly cleanup',
          description: null,
          supportedPlatforms: ['LINUX'],
          deviceCount: 3,
          trigger: 'DATE_TIME',
          timeReference: 'SERVER',
          startAt: '2026-11-20T22:00:00Z',
          repeat: 86400,
        },
      },
      {
        node: {
          id: 'schedule-2',
          name: 'On reconnect',
          description: null,
          supportedPlatforms: ['WINDOWS'],
          deviceCount: 1,
          trigger: 'DEVICE_ONLINE',
          timeReference: 'SERVER',
          startAt: null,
          repeat: null,
        },
      },
    ],
    pageInfo: PAGE_INFO,
  },
  scriptScheduleFilters: { platforms: [{ value: 'LINUX', label: 'Linux', count: 1 }] },
};

/** What the fake server answers, by operation. */
const ANSWERS: Record<string, unknown> = {
  scriptsTableQuery: SCRIPTS,
  scriptSchedulesTableQuery: SCHEDULES,
  useScriptArchiveUnarchiveMutation: { unarchiveScript: { id: 'script-1', status: 'ACTIVE' } },
  useScheduleArchiveUnarchiveMutation: { unarchiveScriptSchedule: { id: 'schedule-1', status: 'ACTIVE' } },
  scriptFiltersRefreshRelayQuery: { scriptFilters: SCRIPTS.scriptFilters },
  scriptScheduleFiltersRefreshRelayQuery: { scriptScheduleFilters: SCHEDULES.scriptScheduleFilters },
  scriptTagsRelayFilterQuery: { scriptsTags: [] },
};

interface SeenRequest {
  name: string;
  variables: Record<string, unknown>;
}

/** The operations the environment was asked for, in order, with their variables. */
let requests: SeenRequest[] = [];
let container: HTMLDivElement;
let root: Root;

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
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
const openAt = (search: string) => window.history.replaceState(null, '', `/scripts/archived${search}`);
const reads = (name: string) => requests.filter(request => request.name === name);
const pagerRow = () => container.querySelector('[data-table-meta]')?.textContent ?? '';
const click = async (element: Element | null | undefined) => {
  expect(element).toBeTruthy();
  act(() => (element as HTMLElement).click());
  await settle();
};
const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    element => element.getAttribute('aria-label') === label || element.textContent === label,
  );

beforeEach(() => {
  stubLayoutApis();
  answerTableFlag('off');
  openAt('');
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

const PAGES = [
  {
    name: 'the archived scripts page',
    page: () => <ScriptsTable archived />,
    query: 'scriptsTableQuery',
    row: 'Clear temp files',
    unarchive: 'Unarchive Script',
    mutation: 'useScriptArchiveUnarchiveMutation',
  },
  {
    name: 'the archived schedules page',
    page: () => <ScriptSchedulesTable archived />,
    query: 'scriptSchedulesTableQuery',
    row: 'Nightly cleanup',
    unarchive: 'Unarchive Schedule',
    mutation: 'useScheduleArchiveUnarchiveMutation',
  },
];

describe.each(PAGES)('$name', ({ page, query, row, unarchive, mutation }) => {
  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    await render(page());

    expect(container.textContent).toContain(row);
    expect(reads(query)[0]?.variables).toMatchObject({ first: 20, after: null, last: null, before: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it('pages back on the server: a cursor read backward is sent as last / before', async () => {
    openAt('?cursor=c-41&page=3&dir=before');
    await render(page());

    expect(reads(query)[0]?.variables).toMatchObject({ first: null, after: null, last: 20, before: 'c-41' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('reads its page again after an unarchive (the list is marked changed)', async () => {
    await render(page());
    const before = reads(query).length;

    await click(button(unarchive));
    await click(button('Confirm restore'));

    expect(reads(mutation)).toHaveLength(1);
    expect(reads(mutation)[0]?.variables).toEqual({ id: expect.any(String) });
    expect(reads(query).length).toBe(before + 1);
    expect(container.textContent).toContain(row);
  });
});
