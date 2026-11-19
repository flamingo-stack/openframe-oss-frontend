/**
 * The work time table in its two layouts, in each of its three hosts' column sets: the Worktime page (employee and
 * customer), a customer's Worktime tab (employee) and an employee's page (customer).
 *
 * Card rows (the app's table flag off) are locked as markup: those snapshots were recorded BEFORE the table learned
 * the grid layout, and that change left them untouched. Update one only for a change that means to alter the card
 * rows.
 *
 * The grid (the flag on): the lib's grid table at its natural height (the stat cards and the filters sit above it),
 * with the gear of its saved column settings, delete and edit as two action columns and one line in every cell.
 *
 * The table is mounted through its own reader: the query answers from `ANSWER` below.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '../live-table.fixtures';
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
} from '../table-grid-flag.fixtures';
import { WorkTimeTable } from './work-time-table';

// A day is printed in the viewer's zone: the snapshots are the same on every machine.
vi.hoisted(() => {
  process.env.TZ = 'UTC';
});

/**
 * What the table's query answers: one stable record (the reader keeps its identity). The first entry is full; the
 * second has no ticket, notes, customer or email, and its employee was deleted.
 */
const ANSWER = {
  employeeTimeStats: {
    todayTotalSeconds: 5400,
    todayEntryCount: 2,
    periodTotalSeconds: 86400,
    periodEntryCount: 14,
    averagePerDaySeconds: 12342,
  },
  employeeTimeEntries: {
    filteredCount: 2,
    pageInfo: { hasNextPage: false, endCursor: null },
    edges: [
      {
        node: {
          id: 'te-1',
          durationSeconds: 5400,
          startedAt: '2026-01-15T12:00:00Z',
          ticketId: 't-1',
          ticketNumber: 3891,
          ticketTitle: 'Printer on the second floor prints blank pages',
          notes: 'Replaced the toner and ran the cleaning cycle twice',
          user: {
            id: 'VXNlcjp1c2VyLTE=',
            firstName: 'Maya',
            lastName: 'Chen',
            email: 'maya@msp.test',
            status: 'ACTIVE',
            image: null,
          },
          organization: {
            organizationId: 'org-1',
            name: 'Acme Corp',
            contactInformation: { contacts: [{ email: 'it@acme.test' }] },
            image: null,
          },
        },
      },
      {
        node: {
          id: 'te-2',
          durationSeconds: 900,
          startedAt: '2026-01-14T12:00:00Z',
          ticketId: null,
          ticketNumber: null,
          ticketTitle: null,
          notes: null,
          user: {
            id: 'VXNlcjp1c2VyLTI=',
            firstName: 'Sam',
            lastName: 'Reed',
            email: 'sam@msp.test',
            status: 'DELETED',
            image: null,
          },
          organization: null,
        },
      },
    ],
  },
};

// A fragment reference IS its data here, and the query answers `ANSWER`.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useLazyLoadQuery: () => ANSWER,
  usePaginationFragment: (_fragment: unknown, ref: unknown) => ({
    data: ref,
    loadNext: () => {},
    hasNext: false,
    isLoadingNext: false,
  }),
  useMutation: () => [() => {}, false],
  fetchQuery: () => ({ subscribe: () => {} }),
  commitMutation: () => {},
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/worktime',
  useSearchParams: () => new URLSearchParams(),
}));
// The header filters' option lists and the entry modal read their own data.
vi.mock('@/app/(app)/tickets/hooks/use-assignee-options', () => ({
  ASSIGNEE_FILTER_PAGE_SIZE: 100,
  useAssigneeOptions: () => ({ options: [{ value: 'user-1', label: 'Maya Chen' }] }),
}));
vi.mock('@/app/(app)/tickets/hooks/use-ticket-options', () => ({
  useOrganizationOptions: () => ({ options: [{ value: 'org-1', label: 'Acme Corp' }] }),
}));
vi.mock('@/app/components/manual-entry-modal', () => ({ ManualEntryModal: () => null }));

const worktimePage = () => <WorkTimeTable showEmployee showCustomer />;
const customerTab = () => <WorkTimeTable showEmployee organizationGlobalId="T3JnYW5pemF0aW9uOm9yZy0x" />;
const employeePage = () => <WorkTimeTable showCustomer employeeId="user-1" />;

beforeAll(stubTableBrowserApis);
afterEach(() => {
  unmountAll();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

describe('work time table, card rows (the flag off)', () => {
  it('the Worktime page: employee and customer', () => {
    setTableGridFlag('off');
    const { container } = mount(worktimePage());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('a customer’s tab: no customer column', () => {
    setTableGridFlag('off');
    const { container } = mount(customerTab());
    expect(container).toMatchSnapshot();
  });

  it('an employee’s page: no employee column', () => {
    setTableGridFlag('off');
    const { container } = mount(employeePage());
    expect(container).toMatchSnapshot();
  });

  it('loading', () => {
    setTableGridFlag('off');
    const { container } = mount(<LoadingScope>{worktimePage()}</LoadingScope>);
    expect(container).toMatchSnapshot();
  });
});

/** The buttons of one entry action in a grid table's rows. */
const actionButtons = (scope: ParentNode, label: string) =>
  scope.querySelectorAll(`[data-grid-body] button[aria-label="${label}"]`);

describe('work time table, the grid (the flag on)', () => {
  it('the Worktime page: one line in every cell, delete and edit in every row, the page scrolls', () => {
    setTableGridFlag('on');
    const { container } = mount(worktimePage());

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['employee', 'time', 'customer', 'ticketNotes']);
    expect(settingsGear(container)).not.toBeNull();
    // The stat cards and the filters sit above the table: it keeps its natural height.
    expect(fixedViewport(container)).toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    expect(metaRow(container)?.textContent).toContain('2');

    const body = gridBodyText(container);
    expect(body).toContain('Maya Chen');
    expect(body).toContain('maya@msp.test');
    expect(body).toContain('01:30:00');
    expect(body).toContain('Acme Corp');
    expect(body).toContain('it@acme.test');
    expect(body).toContain('3891 – Printer on the second floor prints blank pages');
    expect(body).toContain('Replaced the toner and ran the cleaning cycle twice');
    // Each action is a column of its own.
    expect(actionButtons(container, 'Delete Entry')).toHaveLength(2);
    expect(actionButtons(container, 'Edit Entry')).toHaveLength(2);
    // The stat cards stay above the table.
    expect(container.textContent).toContain('TODAY TOTAL');
  });

  it('draws only the host’s columns: a customer’s tab, an employee’s page', () => {
    setTableGridFlag('on');
    expect(gridColumns(mount(customerTab()).container)).toEqual(['employee', 'time', 'ticketNotes']);
    expect(gridColumns(mount(employeePage()).container)).toEqual(['time', 'customer', 'ticketNotes']);
  });

  it('keeps a column layout per host: each draws another column set', () => {
    setTableGridFlag('on');
    saveHiddenColumn('work-time', 'ticketNotes');
    expect(gridColumns(mount(worktimePage()).container)).toEqual(['employee', 'time', 'customer']);
    expect(gridColumns(mount(customerTab()).container)).toEqual(['employee', 'time', 'ticketNotes']);
    expect(gridColumns(mount(employeePage()).container)).toEqual(['time', 'customer', 'ticketNotes']);

    unmountAll();
    window.localStorage.clear();
    saveHiddenColumn('work-time-customer', 'time');
    saveHiddenColumn('work-time-employee', 'customer');
    expect(gridColumns(mount(customerTab()).container)).toEqual(['employee', 'ticketNotes']);
    expect(gridColumns(mount(employeePage()).container)).toEqual(['time', 'ticketNotes']);
    expect(gridColumns(mount(worktimePage()).container)).toEqual(['employee', 'time', 'customer', 'ticketNotes']);
  });

  it('names no column while the entries are read', () => {
    setTableGridFlag('on');
    const { container } = mount(<LoadingScope>{worktimePage()}</LoadingScope>);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual([]);
    expect(loadingHeaderCells(container).length).toBeGreaterThan(0);
  });

  it('draws its loading state while the flag is read, then the grid: never card rows first', () => {
    setTableGridFlag('loading');
    const { container } = mount(worktimePage());
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain('Maya Chen');

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain('Maya Chen');
  });
});
