/**
 * The knowledge base listing, its archive and the Assigned Articles tab read one page per request, the cursor in the
 * URL. They page forward only (`first` / `after`). Over the real pages, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range over the server's total
 * - the URL's cursor is sent as `after`, and labels the range with the URL's page
 * - the Assigned Articles tab reads its keys under its prefix (`articlesCursor`, `articlesSearch`), never a sibling's
 * - a change to the tags drops the cursor in the same URL write
 * - an archive and an unassign mark the list changed and the page is read again (a paged list has no connection to
 *   edit)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactElement, type ReactNode } from 'react';
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
vi.mock('@/app/(app)/mingo/hooks/use-generate-with-ai-action', () => ({ useGenerateWithAiAction: () => undefined }));
vi.mock('@/app/(app)/mingo/stores/mingo-created-entities-store', () => ({ useMingoCreatedEpoch: () => 0 }));
// The toolbars' tag pickers read their own data: here, one button that picks a tag through the page's filter state.
vi.mock('./components/shared/knowledge-base-search-toolbar', () => ({
  KnowledgeBaseSearchToolbar: ({ filters }: { filters: { addTag: (tag: { id: string; key: string }) => void } }) => (
    <button onClick={() => filters.addTag({ id: 't-1', key: 'vpn' })}>Pick tag vpn</button>
  ),
}));
vi.mock('./components/shared/knowledge-base-tags-filter-modal', () => ({
  KnowledgeBaseTagsFilterModal: ({ onApply }: { onApply: (tags: { id: string; key: string }[]) => void }) => (
    <button onClick={() => onApply([{ id: 't-1', key: 'vpn' }])}>Apply tag vpn</button>
  ),
}));
// The confirm dialog: a button that confirms, drawn while the dialog is open.
vi.mock('@/app/components/shared/confirm-dialog', () => ({
  ConfirmDialog: ({ open, confirmLabel, onConfirm }: { open: boolean; confirmLabel: string; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm}>{confirmLabel}</button> : null,
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

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/knowledgeBaseItemsTableQuery.graphql'),
    import('@/__generated__/archivedArticlesTableQuery.graphql'),
    import('@/__generated__/assignedArticlesTableQuery.graphql'),
    import('@/__generated__/assignedArticlesTableUnassignMutation.graphql'),
    import('@/__generated__/assignArticleModalMutation.graphql'),
    import('@/__generated__/knowledgeBaseItemNameCell_item.graphql'),
    import('@/__generated__/knowledgeBaseItemCreatedCell_item.graphql'),
    import('@/__generated__/knowledgeBaseItemActionsCell_item.graphql'),
    import('@/__generated__/knowledgeBaseItemDialogs_item.graphql'),
    import('@/__generated__/archivedArticleDateCell_article.graphql'),
    import('@/__generated__/archiveArticleModal_article.graphql'),
    import('@/__generated__/archiveArticleModalMutation.graphql'),
    import('@/__generated__/unarchiveArticleModal_article.graphql'),
    import('@/__generated__/unarchiveArticleModalMutation.graphql'),
    import('@/__generated__/renameFolderModal_folder.graphql'),
    import('@/__generated__/renameFolderModalMutation.graphql'),
    import('@/__generated__/moveToFolderModal_item.graphql'),
    import('@/__generated__/moveToFolderModalMutation.graphql'),
    import('@/__generated__/deleteFolderModal_folder.graphql'),
    import('@/__generated__/deleteFolderModalMutation.graphql'),
    import('@/__generated__/newFolderModalMutation.graphql'),
  ]);
  const names = [
    'knowledgeBaseItemsTableQuery',
    'archivedArticlesTableQuery',
    'assignedArticlesTableQuery',
    'assignedArticlesTableUnassignMutation',
    'assignArticleModalMutation',
    'knowledgeBaseItemNameCell_item',
    'knowledgeBaseItemCreatedCell_item',
    'knowledgeBaseItemActionsCell_item',
    'knowledgeBaseItemDialogs_item',
    'archivedArticleDateCell_article',
    'archiveArticleModal_article',
    'archiveArticleModalMutation',
    'unarchiveArticleModal_article',
    'unarchiveArticleModalMutation',
    'renameFolderModal_folder',
    'renameFolderModalMutation',
    'moveToFolderModal_item',
    'moveToFolderModalMutation',
    'deleteFolderModal_folder',
    'deleteFolderModalMutation',
    'newFolderModalMutation',
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

import { ArchivedArticlesView } from './components/archive/archived-articles-view';
import { AssignedArticlesTab } from './components/assigned-articles/assigned-articles-tab';
import { customerArticlesTarget } from './components/assigned-articles/assigned-articles-target';
import { KnowledgeBaseView } from './components/item-list/knowledge-base-view';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: false, hasPreviousPage: false };

const item = (id: string, type: 'FOLDER' | 'ARTICLE', name: string, status: string | null) => ({
  __typename: 'KnowledgeBaseItem',
  id,
  type,
  name,
  status,
  summary: null,
  createdAt: '2026-01-12T14:05:00Z',
  updatedAt: '2026-01-13T08:00:00Z',
  parent: null,
});

const FOLDER = item('kb-1', 'FOLDER', 'Onboarding', null);
const ARTICLE = item('kb-2', 'ARTICLE', 'Reset a user password', 'PUBLISHED');
const DRAFT = item('kb-3', 'ARTICLE', 'VPN setup', 'DRAFT');
const ARCHIVED = item('kb-4', 'ARTICLE', 'Old printer guide', 'ARCHIVED');
const ARCHIVED_TOO = item('kb-5', 'ARTICLE', 'Fax setup', 'ARCHIVED');

const answerPage = (...nodes: object[]) => ({
  filteredCount: 42,
  edges: nodes.map(node => ({ node })),
  pageInfo: PAGE_INFO,
});

/** What the fake server answers, by operation. */
const ANSWERS: Record<string, unknown> = {
  knowledgeBaseItemsTableQuery: { knowledgeBaseItems: answerPage(FOLDER, ARTICLE) },
  archivedArticlesTableQuery: { archivedArticles: answerPage(ARCHIVED, ARCHIVED_TOO) },
  assignedArticlesTableQuery: { knowledgeBaseItems: answerPage(ARTICLE, DRAFT) },
  archiveArticleModalMutation: {
    archiveArticle: { id: 'kb-2', status: 'ARCHIVED', updatedAt: '2026-01-14T08:00:00Z' },
  },
  assignedArticlesTableUnassignMutation: { unassignItem: true },
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const providers = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <RelayEnvironmentProvider environment={environment}>{children}</RelayEnvironmentProvider>
    </QueryClientProvider>
  );
  act(() => root.render(providers(element)));
  await settle();
}

/** The page's URL, as the browser shows it. */
const openAt = (path: string, search = '') => window.history.replaceState(null, '', `${path}${search}`);
const reads = (name: string) => requests.filter(request => request.name === name);
const pagerRow = () => container.querySelector('[data-table-meta]')?.textContent ?? '';
const urlParams = () => new URLSearchParams(window.location.search);
/**
 * The query of every history entry the page pushed while `run` ran. The library's navigation shim writes the URL with
 * `history.pushState` / `replaceState`; a filter change is ONE push that already has no cursor (the pager's own safety
 * net would drop a cursor left behind, but in a second write, after an entry that pairs the new filter with the old
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

beforeEach(() => {
  stubLayoutApis();
  answerTableFlag('off');
  openAt('/knowledge-base');
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

const TOP_LEVEL_PAGES = [
  {
    name: 'the knowledge base',
    path: '/knowledge-base',
    page: () => <KnowledgeBaseView folderId={null} />,
    query: 'knowledgeBaseItemsTableQuery',
    row: 'Reset a user password',
  },
  {
    name: 'the archive',
    path: '/knowledge-base/archive',
    page: () => <ArchivedArticlesView />,
    query: 'archivedArticlesTableQuery',
    row: 'Old printer guide',
  },
];

describe.each(TOP_LEVEL_PAGES)('$name', ({ path, page, query, row }) => {
  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    openAt(path);
    await render(page());

    expect(container.textContent).toContain(row);
    expect(reads(query)[0]?.variables).toMatchObject({ first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("sends the URL's cursor as after and labels the range with the URL's page", async () => {
    openAt(path, '?cursor=c-40&page=3');
    await render(page());

    expect(reads(query)[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops the cursor in the same URL write that picks a tag (one history entry)', async () => {
    openAt(path, '?cursor=c-40&page=3');
    await render(page());

    const pushed = await pushedWhile(() => click(buttons('Pick tag vpn')[0]));

    expect(pushed.map(params => params.toString())).toEqual(['tags=t-1%3Avpn']);
    expect(urlParams().toString()).toBe('tags=t-1%3Avpn');
  });
});

describe('the knowledge base: a row dialog', () => {
  it('reads its page again after an archive (the list is marked changed)', async () => {
    await render(<KnowledgeBaseView folderId={null} />);
    const before = reads('knowledgeBaseItemsTableQuery').length;

    await click(buttons('Archive')[0]);
    await click(buttons('Archive Article')[0]);

    expect(reads('archiveArticleModalMutation')).toHaveLength(1);
    expect(reads('archiveArticleModalMutation')[0]?.variables).toEqual({ id: 'kb-2' });
    expect(reads('knowledgeBaseItemsTableQuery').length).toBe(before + 1);
    expect(container.textContent).toContain('Reset a user password');
  });
});

describe("the Assigned Articles tab, in a customer's page", () => {
  const CUSTOMER = customerArticlesTarget('org-1');
  const PATH = '/customers/details';
  const tab = () => <AssignedArticlesTab target={CUSTOMER} />;

  it("reads its keys under the tab's prefix, never the page's own", async () => {
    openAt(PATH, '?id=org-1&cursor=c-other&search=other&articlesCursor=c-40&articlesPage=3&articlesSearch=vpn');
    await render(tab());

    const [first] = reads('assignedArticlesTableQuery');
    expect(first?.variables).toMatchObject({ search: 'vpn', first: 20, after: 'c-40' });
    expect(first?.variables.filter).toMatchObject({ assignedTo: CUSTOMER });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('reads the first page with no prefixed cursor in the URL', async () => {
    openAt(PATH, '?id=org-1&cursor=c-other');
    await render(tab());

    expect(reads('assignedArticlesTableQuery')[0]?.variables).toMatchObject({ search: null, first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("drops only its own cursor in the URL write that applies a tag, leaving the page's params", async () => {
    openAt(PATH, '?id=org-1&cursor=c-other&articlesCursor=c-40&articlesPage=3');
    await render(tab());

    const pushed = await pushedWhile(() => click(buttons('Apply tag vpn')[0]));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({ id: 'org-1', cursor: 'c-other', articlesTags: 't-1:vpn' });
    expect(urlParams().getAll('articlesTags')).toEqual(['t-1:vpn']);
    expect(urlParams().has('articlesCursor')).toBe(false);
  });

  it('reads its page again after an unassign (the list is marked changed)', async () => {
    openAt(PATH, '?id=org-1');
    await render(tab());
    const before = reads('assignedArticlesTableQuery').length;

    await click(buttons('Unassign')[0]);

    expect(reads('assignedArticlesTableUnassignMutation')).toHaveLength(1);
    expect(reads('assignedArticlesTableUnassignMutation')[0]?.variables).toEqual({
      itemId: 'kb-2',
      targetType: CUSTOMER.targetType,
      targetId: CUSTOMER.targetId,
    });
    expect(reads('assignedArticlesTableQuery').length).toBe(before + 1);
    expect(container.textContent).toContain('Reset a user password');
  });
});
