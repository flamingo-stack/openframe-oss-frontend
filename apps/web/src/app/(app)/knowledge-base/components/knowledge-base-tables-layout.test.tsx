/**
 * The knowledge base tables in their two layouts: a level's items, the Assigned Articles tab of a customer or a
 * device, and the archive.
 *
 * Card rows (the app's table flag off) are locked as markup: those snapshots were recorded BEFORE the tables learned
 * the grid layout, and that change left them untouched. Update one only for a change that means to alter the card
 * rows.
 *
 * The grid (the flag on): the lib's grid table with the gear of its saved column settings, the row menu and the open
 * action as action columns, and one line in every cell. A level's items and the archive are their page's scroll
 * area; the Assigned Articles tab is a section of a longer page.
 *
 * Every table is mounted through its own reader: the queries answer from `ANSWER` below.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  loadingHeaderCells,
  metaRow,
  saveHiddenColumn,
  settingsGear,
  setTableGridFlag,
  stubTableBrowserApis,
  twoLineCells,
} from '@/app/components/shared/table-grid-flag.fixtures';
import { ArchivedArticlesTable } from './archive/archived-articles-table';
import { AssignedArticlesTable } from './assigned-articles/assigned-articles-table';
import { KnowledgeBaseItemsTable } from './item-list/knowledge-base-items-table';

// A time of day is printed in the viewer's zone: the snapshots are the same on every machine.
vi.hoisted(() => {
  process.env.TZ = 'UTC';
});

const NO_NEXT = { hasNextPage: false, endCursor: null };

const FOLDER = {
  id: 'kb-1',
  type: 'FOLDER',
  name: 'Onboarding',
  status: null,
  summary: null,
  createdAt: '2026-01-10T09:30:00Z',
  updatedAt: '2026-01-10T09:30:00Z',
  parent: null,
};
const ARTICLE = {
  id: 'kb-2',
  type: 'ARTICLE',
  name: 'Reset a user password',
  status: 'PUBLISHED',
  summary: 'Steps for the service desk when a user is locked out of their account',
  createdAt: '2026-01-12T14:05:00Z',
  updatedAt: '2026-01-13T08:00:00Z',
  parent: { name: 'Onboarding' },
};
const DRAFT = {
  id: 'kb-3',
  type: 'ARTICLE',
  name: 'VPN setup',
  status: 'DRAFT',
  summary: null,
  createdAt: '2026-01-14T16:45:00Z',
  updatedAt: '2026-01-14T16:45:00Z',
  parent: null,
};
const ARCHIVED = { ...ARTICLE, id: 'kb-4', name: 'Old printer guide', status: 'ARCHIVED' };

const edges = (...nodes: object[]) => nodes.map(node => ({ node }));

/**
 * What every query of these tables answers: one stable record (the readers keep its identity), each table reading its
 * own field of it.
 */
const ANSWER = {
  knowledgeBaseItems: { __id: 'conn-items', filteredCount: 3, pageInfo: NO_NEXT, edges: edges(FOLDER, ARTICLE, DRAFT) },
  archivedArticles: { __id: 'conn-archive', filteredCount: 1, pageInfo: NO_NEXT, edges: edges(ARCHIVED) },
};

// A fragment reference IS its data here, and every query answers `ANSWER`: a table reads its rows from that object.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, key: unknown) => key,
  readInlineData: (_fragment: unknown, key: unknown) => key,
  useLazyLoadQuery: () => ANSWER,
  usePaginationFragment: (_fragment: unknown, ref: unknown) => ({
    data: ref,
    loadNext: () => {},
    hasNext: false,
    isLoadingNext: false,
  }),
  useMutation: () => [() => {}, false],
  useRelayEnvironment: () => ({}),
  useSubscribeToInvalidationState: () => {},
  fetchQuery: () => ({ subscribe: () => {} }),
  commitMutation: () => {},
  commitLocalUpdate: () => {},
  ConnectionHandler: {},
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/knowledge-base',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/(app)/mingo/stores/mingo-created-entities-store', () => ({ useMingoCreatedEpoch: () => 0 }));
// The row dialogs read their own data and open only on a click.
vi.mock('./item-list/knowledge-base-item-dialogs', () => ({ KnowledgeBaseItemDialogs: () => null }));
vi.mock('./dialogs/unarchive-article-modal', () => ({ UnarchiveArticleModal: () => null }));

const noop = () => {};
const OFFSET = 'top-[72px]';
const ROOT = { parentId: null, search: '', tagIds: [] };
const CUSTOMER = { targetType: 'ORGANIZATION', targetId: 'T3JnYW5pemF0aW9uOm9yZy0x' } as const;

const items = (listing: { parentId: string | null; search: string; tagIds: string[] } = ROOT) => (
  <KnowledgeBaseItemsTable listing={listing} isPending={false} onEmptyChange={noop} stickyHeaderOffset={OFFSET} />
);
const assigned = () => (
  <AssignedArticlesTable
    target={CUSTOMER}
    listing={{ search: '', tagIds: [] }}
    isPending={false}
    refreshKey={0}
    onChanged={noop}
    onEmptyChange={noop}
    stickyHeaderOffset={OFFSET}
  />
);
const archive = () => <ArchivedArticlesTable search="" tagIds={[]} isPending={false} stickyHeaderOffset={OFFSET} />;

beforeAll(stubTableBrowserApis);
afterEach(() => {
  unmountAll();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

describe('knowledge base tables, card rows (the flag off)', () => {
  it('a level’s items', () => {
    setTableGridFlag('off');
    const { container } = mount(items());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('a search: every row says its folder', () => {
    setTableGridFlag('off');
    const { container } = mount(items({ parentId: null, search: 'password', tagIds: [] }));
    expect(container).toMatchSnapshot();
  });

  it('a level’s items, loading', () => {
    setTableGridFlag('off');
    const { container } = mount(<LoadingScope>{items()}</LoadingScope>);
    expect(container).toMatchSnapshot();
  });

  it('the Assigned Articles tab', () => {
    setTableGridFlag('off');
    const { container } = mount(assigned());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('the archive', () => {
    setTableGridFlag('off');
    const { container } = mount(archive());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });
});

/** The open-in-new-tab buttons and the row menus' triggers of a grid table's rows. */
const openButtons = (scope: ParentNode) =>
  scope.querySelectorAll('[data-grid-body] button[aria-label="Open in new tab"]');
/** Every button in a grid table's rows: each row has its menu's trigger and its open button. */
const rowButtons = (scope: ParentNode) => scope.querySelectorAll('[data-grid-body] button');

describe('knowledge base tables, the grid (the flag on)', () => {
  it('a level’s items: one line in every cell, the menu and the open action in every row, the page’s scroll area', () => {
    setTableGridFlag('on');
    const { container } = mount(items());

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'created']);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).not.toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(metaRow(container)?.textContent).toContain('3');

    const body = gridBodyText(container);
    expect(body).toContain('Onboarding');
    expect(body).toContain('Reset a user password');
    expect(body).toContain('Steps for the service desk when a user is locked out of their account');
    expect(body).toContain('DRAFT');
    // The day and its time are one line.
    expect(body).toContain('2:05 PM');
    // Two action columns: a menu trigger and an open button in each of the three rows.
    expect(openButtons(container)).toHaveLength(3);
    expect(rowButtons(container)).toHaveLength(6);
  });

  it('a search: the folder sits beside the summary on the name’s line', () => {
    setTableGridFlag('on');
    const { container } = mount(items({ parentId: null, search: 'password', tagIds: [] }));
    expect(gridBodyText(container)).toContain('Onboarding · Steps for the service desk');
    expect(twoLineCells(container)).toHaveLength(0);
  });

  it('the Assigned Articles tab: the grid at its natural height (a section of a details page)', () => {
    setTableGridFlag('on');
    const { container } = mount(assigned());
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'created']);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(openButtons(container)).toHaveLength(3);
    expect(rowButtons(container)).toHaveLength(6);
  });

  it('the archive: the grid as the page’s scroll area, with its own date column', () => {
    setTableGridFlag('on');
    const { container } = mount(archive());
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'archived']);
    expect(fixedViewport(container)).not.toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(gridBodyText(container)).toContain('Old printer guide');
    expect(gridBodyText(container)).toContain('ARCHIVED');
    expect(rowButtons(container)).toHaveLength(2);
  });

  it('keeps a column layout per table', () => {
    setTableGridFlag('on');
    saveHiddenColumn('knowledge-base-items', 'created');
    expect(gridColumns(mount(items()).container)).toEqual(['name']);
    expect(gridColumns(mount(assigned()).container)).toEqual(['name', 'created']);
    expect(gridColumns(mount(archive()).container)).toEqual(['name', 'archived']);

    unmountAll();
    window.localStorage.clear();
    saveHiddenColumn('assigned-articles', 'created');
    saveHiddenColumn('knowledge-base-archive', 'archived');
    expect(gridColumns(mount(assigned()).container)).toEqual(['name']);
    expect(gridColumns(mount(archive()).container)).toEqual(['name']);
    expect(gridColumns(mount(items()).container)).toEqual(['name', 'created']);
  });

  it('names no column while the rows are read', () => {
    setTableGridFlag('on');
    const { container } = mount(<LoadingScope>{items()}</LoadingScope>);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual([]);
    expect(loadingHeaderCells(container).length).toBeGreaterThan(0);
  });

  it.each([
    ['a level’s items', items, 'Reset a user password'],
    ['the Assigned Articles tab', assigned, 'Reset a user password'],
    ['the archive', archive, 'Old printer guide'],
  ])('%s: loading rows while the flag is read, then the grid, never card rows first', (_name, table, row) => {
    setTableGridFlag('loading');
    const { container } = mount(table());
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain(row);

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain(row);
  });
});
