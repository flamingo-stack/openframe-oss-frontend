/**
 * The ticket tables in their two layouts: the /tickets list and its archive (`TicketsTable`), the table body they
 * share with other screens (`TicketTableBody`) and the shared ticket columns.
 *
 * Card rows (the app's table flag off, and what a screen that passes no layout draws) are locked as markup: those
 * snapshots were recorded BEFORE the tables learned the grid layout, and that change left them untouched. Update one
 * only for a change that means to alter the card rows.
 *
 * The grid (the flag on): the lib's grid table with the gear of its saved column settings, the open action as an
 * action column, one line in every cell, and the page's scroll area on the list and the archive.
 */

import type { ColumnDef } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  loadingHeaderCells,
  saveHiddenColumn,
  settingsGear,
  setTableGridFlag,
  stubTableBrowserApis,
  twoLineCells,
} from '@/app/components/shared/table-grid-flag.fixtures';
import type { Dialog } from '../types/dialog.types';
import { getTicketOpenColumn, getTicketTableColumns, TicketTableBody } from './ticket-table-columns';
import { ArchivedTickets, CurrentTickets } from './tickets-table';

const hooks = vi.hoisted(() => ({ useTicketsQuery: vi.fn() }));

vi.mock('../hooks/use-tickets-query', () => ({ TICKETS_PAGE_SIZE: 20, useTicketsQuery: hooks.useTicketsQuery }));
vi.mock('../hooks/use-assignee-options', () => ({
  ASSIGNEE_FILTER_PAGE_SIZE: 100,
  useAssigneeOptions: () => ({ options: [], isLoading: false, onSearchChange: () => {} }),
}));
vi.mock('../hooks/use-tickets-actions', () => ({
  emphasizeNewTicketAction: (actions: unknown[]) => actions,
  useTicketsActions: () => ({ actions: [], menuActions: [], dialog: null }),
}));
vi.mock('../statuses/hooks/use-ticket-statuses-query', () => ({
  useTicketStatusesQuery: () => ({ data: [], isLoading: false }),
}));
// The toolbar, the filter modal and the first-run empty state read their own data; the table is what is under test.
vi.mock('./ticket-tag-filter', () => ({ TicketTagFilter: () => null }));
vi.mock('./tickets-filter-modal', () => ({ TicketsFilterModal: () => null }));
vi.mock('./tickets-empty-state', () => ({ TicketsEmptyState: () => <p data-empty-state>No tickets yet</p> }));
// The first-assignment picker of an unassigned row reads the assignee list and holds a mutation.
vi.mock('./table-assignee-cell', () => ({
  UnassignedTicketCell: ({ interactive }: { interactive: boolean }) => (
    <span data-unassigned={interactive ? 'pick' : 'label'}>Unassigned</span>
  ),
}));
vi.mock('@/app/hooks/use-user-status-map', () => ({
  useUserStatusMap: () => ({ isUserDeleted: (id?: string | null) => id === 'user-gone' }),
}));
vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 'top-[72px]' }),
}));
// Something under the shared ticket columns reaches a Relay-tagged query; the tag needs the Babel transform vitest
// does not run, and nothing here executes it.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/tickets',
  useSearchParams: () => new URLSearchParams(),
}));

const NOW = new Date('2026-01-15T12:00:00Z');

/** A ticket in full: a device and its customer, an assignee, unread messages. */
const PRINTER: Dialog = {
  id: 't-1',
  title: 'Printer on the second floor prints blank pages',
  ticketNumber: 3891,
  createdAt: '2026-01-15T11:55:00Z',
  owner: { type: 'CLIENT', machineId: 'm-1', machine: { id: 'm-1', machineId: 'm-1', hostname: 'front-desk-pc' } },
  organizationName: 'Acme Corp',
  assignedTo: 'user-1',
  assignedName: 'Maya Chen',
  statusId: 's-1',
  statusName: 'In progress',
  statusColor: 'blue',
  statusKind: 'IN_PROGRESS',
  unreadMessageCount: 3,
};
/** A ticket nobody owns, with no device behind it. */
const VPN: Dialog = {
  id: 't-2',
  title: 'VPN drops every hour',
  ticketNumber: 3890,
  createdAt: '2026-01-14T09:00:00Z',
  owner: { type: 'ADMIN' },
  statusId: 's-2',
  statusName: 'New',
  statusColor: 'grey',
  statusKind: 'NEW',
};
/** A ticket whose assignee was deleted. */
const LICENCE: Dialog = {
  ...VPN,
  id: 't-3',
  title: 'Licence renewal',
  ticketNumber: 3889,
  assignedTo: 'user-gone',
  assignedName: 'Sam Reed',
};
const TICKETS = [PRINTER, VPN, LICENCE];

const answer = (fields: Record<string, unknown> = {}) => ({
  dialogs: TICKETS,
  isLoading: false,
  isPending: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  error: null,
  ...fields,
});

const noop = () => {};
const listProps = { search: '', onSearchChange: noop, tagIds: [], onTagIdsChange: noop, onSortChange: noop };
const NEWEST_FIRST = { direction: 'DESC' } as Parameters<typeof CurrentTickets>[0]['sort'];

const list = () => <CurrentTickets {...listProps} sort={NEWEST_FIRST} />;
const archive = () => <ArchivedTickets {...listProps} sort={NEWEST_FIRST} />;

beforeAll(stubTableBrowserApis);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  hooks.useTicketsQuery.mockReset();
  hooks.useTicketsQuery.mockReturnValue(answer());
});
afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

describe('ticket tables, card rows (the flag off)', () => {
  it('the table body: loaded, as a screen that passes no layout draws it', () => {
    const { container } = mount(<TicketTableBody tickets={TICKETS} pageSize={20} />);
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('the table body: loading', () => {
    const { container } = mount(<TicketTableBody tickets={[]} isLoading skeletonRows={2} />);
    expect(container).toMatchSnapshot();
  });

  it('the /tickets list', () => {
    setTableGridFlag('off');
    const { container } = mount(list());
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

/** The open-in-new-tab buttons of a grid table's rows. */
const openButtons = (scope: ParentNode) =>
  scope.querySelectorAll('[data-grid-body] button[aria-label="Open in new tab"]');

describe('ticket tables, the grid (the flag on)', () => {
  it('the /tickets list: one line in every cell, the open action in every row, the page’s scroll area', () => {
    setTableGridFlag('on');
    const { container } = mount(list());

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['title', 'source', 'assignee', 'status']);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).not.toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);

    const body = gridBodyText(container);
    expect(body).toContain('Printer on the second floor prints blank pages');
    expect(body).toContain('3891 • 5 min ago');
    expect(body).toContain('front-desk-pc');
    expect(body).toContain('Acme Corp');
    expect(body).toContain('Maya Chen');
    expect(body).toContain('In progress');
    expect(body).toContain('Unassigned');
    // The open action is its own column: every row has the button, an unread ticket's too.
    expect(openButtons(container)).toHaveLength(TICKETS.length);
  });

  it('puts the unread count at the end of the title, not in the open button’s place', () => {
    setTableGridFlag('on');
    const { container } = mount(list());
    const mark = container.querySelector('[data-grid-body] [aria-label="3 unread messages"]');
    expect(mark?.textContent).toBe('3');
    expect(mark?.closest('[data-grid-col]')?.getAttribute('data-grid-col')).toBe('title');
  });

  it('keeps the list’s column layout under its own key, apart from the archive’s', () => {
    setTableGridFlag('on');
    saveHiddenColumn('tickets', 'source');
    expect(gridColumns(mount(list()).container)).toEqual(['title', 'assignee', 'status']);
    expect(gridColumns(mount(archive()).container)).toEqual(['title', 'source', 'assignee', 'status']);

    unmountAll();
    window.localStorage.clear();
    saveHiddenColumn('tickets-archive', 'status');
    expect(gridColumns(mount(archive()).container)).toEqual(['title', 'source', 'assignee']);
    expect(gridColumns(mount(list()).container)).toEqual(['title', 'source', 'assignee', 'status']);
  });

  it('the archive: the grid as well, with no first-assignment picker', () => {
    setTableGridFlag('on');
    const { container } = mount(archive());
    expect(gridRoot(container)).not.toBeNull();
    expect(fixedViewport(container)).not.toBeNull();
    expect(container.querySelector('[data-unassigned="pick"]')).toBeNull();
    expect(container.querySelector('[data-unassigned="label"]')).not.toBeNull();
  });

  it('names no column while the first page is read', () => {
    setTableGridFlag('on');
    hooks.useTicketsQuery.mockReturnValue(answer({ dialogs: [], isLoading: true }));
    const { container } = mount(list());
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual([]);
    expect(loadingHeaderCells(container).length).toBeGreaterThan(0);
  });

  it('draws loading rows while the flag is read, then the grid: never card rows first', () => {
    setTableGridFlag('loading');
    const { container } = mount(list());
    // Not answered yet: the table's loading state, with no ticket drawn in either layout.
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain('Printer on the second floor');

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain('Printer on the second floor prints blank pages');
  });

  it('a screen that passes the body no layout stays on card rows, whatever the flag says', () => {
    setTableGridFlag('on');
    const { container } = mount(<TicketTableBody tickets={TICKETS} pageSize={20} />);
    expect(container.innerHTML).not.toContain('data-grid-');
  });
});

describe('the shared ticket columns', () => {
  const columns = getTicketTableColumns() as Array<ColumnDef<Dialog> & { accessorKey?: string }>;

  it('keep their accessor keys: the device and customer tabs pick and size them by it', () => {
    expect(columns.map(column => column.accessorKey)).toEqual(['title', 'source', 'assignee', 'status']);
  });

  it('keep the card rows’ widths and breakpoints beside the grid’s sizes', () => {
    const card = columns.map(column => ({ width: column.meta?.width, hideAt: column.meta?.hideAt }));
    expect(card).toEqual([
      { width: 'w-[60%] content-md:flex-1 min-w-0', hideAt: undefined },
      { width: '', hideAt: 'md' },
      { width: '', hideAt: 'lg' },
      { width: '', hideAt: undefined },
    ]);
    expect(columns.map(column => column.size)).toEqual([420, 280, 280, 180]);
    expect(columns.map(column => column.meta?.label)).toEqual(['Ticket', 'Source', 'Assignee', 'Status']);
    expect(columns.every(column => typeof column.meta?.gridCell === 'function')).toBe(true);
  });

  it('the open column is the grid’s action column and still hides below md in card rows', () => {
    const open = getTicketOpenColumn();
    expect(open.id).toBe('open');
    expect(open.meta?.gridKind).toBe('action');
    expect(open.meta?.hideAt).toBe('md');
    expect(open.enableHiding).toBe(false);
  });
});
