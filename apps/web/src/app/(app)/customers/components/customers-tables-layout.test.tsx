/**
 * The Customers module's tables, in their two layouts.
 *
 * Card rows (no page scope above, and what the app's table flag gives while it is off) are locked as markup: those
 * snapshots were recorded BEFORE the tables learned the grid layout, and that change left them untouched. Update one
 * only for a change that means to alter the card rows.
 *
 * The grid (the flag on, under a page's `TableLayoutScope`): the lib's grid table with the gear of its saved column
 * settings, the open button as an action column, and one line in every cell of the customers list.
 */

import { act, type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import { mount, SentinelObserver, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  mountInScope,
  setTableGridFlag,
  settingsGear,
  twoLineCells,
} from '@/app/components/shared/table-layout-scope.fixtures';
import type { Dialog } from '../../tickets/types/dialog.types';
import type { Customer } from '../hooks/use-customers';
import { CustomersTableBody } from './customers-table-columns';
import { CustomerTicketsTab } from './details-tabs/customer-tickets-tab';

const env = vi.hoisted(() => {
  // The rows write instants on the viewer's clock: the markup is recorded on one zone, whatever the machine's.
  const zone = process.env.TZ;
  process.env.TZ = 'UTC';
  return {
    zone,
    deviceCounts: new Map<string, number>([['org-1', 5]]),
    useTicketsQuery: (): unknown => null,
    isUserDeleted: () => false,
  };
});

// The shared ticket columns reach Relay-tagged modules; the tag needs the Babel transform vitest does not run.
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/customers',
  useSearchParams: () => new URLSearchParams(),
}));
// The devices column's count is its own read, one map for the tenant: the first customer has devices, the second
// has no answer.
vi.mock('../hooks/use-customer-device-counts', () => ({
  useCustomerDeviceCounts: () => ({ deviceCounts: env.deviceCounts, isLoading: false }),
}));
vi.mock('../../tickets/hooks/use-tickets-query', () => ({
  TICKETS_PAGE_SIZE: 20,
  useTicketsQuery: () => env.useTicketsQuery(),
}));
vi.mock('@/app/hooks/use-user-status-map', () => ({
  useUserStatusMap: () => ({ isUserDeleted: env.isUserDeleted }),
}));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', SentinelObserver);
});
afterAll(() => {
  if (env.zone === undefined) delete process.env.TZ;
  else process.env.TZ = env.zone;
});
beforeEach(() => {
  // The rows say how long ago: against one "now".
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  setTableGridFlag('off');
});
afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

const noop = () => {};

const CUSTOMERS: Customer[] = [
  {
    id: 'c-1',
    organizationId: 'org-1',
    name: 'Acme Corp',
    websiteUrl: 'https://acme.test',
    contact: { name: 'Maya Chen', email: 'ops@acme.test' },
    industry: 'Manufacturing',
    mrrUsd: 1200,
    numberOfEmployees: 12,
    contractDue: '',
    lastActivity: '2026-03-10T09:30:00Z',
    imageUrl: 'https://cdn.acme.test/logo.png',
    imageHash: 'abc',
  },
  {
    // No contact email, no logo, and no device count answered for it.
    id: 'c-2',
    organizationId: 'org-2',
    name: 'Globex',
    websiteUrl: '',
    contact: { name: '', email: '' },
    industry: '',
    mrrUsd: 0,
    numberOfEmployees: 1,
    contractDue: '',
    lastActivity: '2026-03-08T12:00:00Z',
    imageUrl: null,
    imageHash: null,
  },
];

const DATE_FILTER: TableDateFilter = { sortDirection: 'desc', range: undefined, onApply: noop };
const NO_NEXT_PAGE = { hasNextPage: false, isFetchingNextPage: false, onLoadMore: noop };

/** The customers list as `/customers` draws it once its first page has answered. */
function customersTable({
  dateFilter,
  isLoading = false,
}: { dateFilter?: TableDateFilter; isLoading?: boolean } = {}): ReactElement {
  return (
    <CustomersTableBody
      customers={isLoading ? [] : CUSTOMERS}
      isLoading={isLoading}
      pageSize={20}
      stickyHeaderOffset="top-[96px]"
      dateFilter={dateFilter}
      footer={NO_NEXT_PAGE}
    />
  );
}

const TICKETS: Dialog[] = [
  {
    id: 't-1',
    title: 'Printer offline',
    ticketNumber: 3891,
    createdAt: '2026-03-10T09:30:00Z',
    owner: {
      type: 'CLIENT',
      machineId: 'm-1',
      machine: { id: 'd-1', machineId: 'm-1', hostname: 'laptop-01', nickname: 'Front desk' },
    },
    deviceHostname: 'laptop-01',
    organizationId: 'org-1',
    organizationName: 'Acme Corp',
    assignedTo: 'u-1',
    assignedName: 'Maya Chen',
    statusId: 's-1',
    statusName: 'In progress',
    statusColor: '#5ea62e',
    statusKind: 'CUSTOM',
  },
  {
    // The AI's own ticket: no title yet, no device, no assignee affordance.
    id: 't-2',
    title: '',
    ticketNumber: 3892,
    createdAt: '2026-03-08T12:00:00Z',
    owner: { type: 'ADMIN' },
    organizationId: 'org-1',
    organizationName: 'Acme Corp',
    statusId: 's-2',
    statusName: 'AI Handling',
    statusKind: 'AI_ASSISTANCE',
  },
] as Dialog[];

const LOADED_TICKETS = {
  dialogs: TICKETS,
  filteredCount: TICKETS.length,
  isLoading: false,
  isPending: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: noop,
  error: null,
};

/** A customer's Tickets tab once the customer and the first page of its tickets have answered. */
function ticketsTab(): ReactElement {
  env.useTicketsQuery = () => LOADED_TICKETS;
  return <CustomerTicketsTab organizationId="org-1" />;
}

/**
 * A mounted table's markup. The date header's menu names its popup with a generated id that counts every id made
 * before it in the run: it is written the same wherever the test runs.
 */
const markup = (container: Element) => container.innerHTML.replace(/radix-_r_[0-9a-z]+_/g, 'radix-id');

/** The date header's control: the label and the calendar, one button that opens the sort and range menu. */
const dateHeaderControl = (scope: ParentNode) =>
  [...scope.querySelectorAll('button')].find(button => button.textContent?.includes('Sort and filter by date'));

describe('Customers list', () => {
  it.each([
    ['a plain Last Activity header', undefined],
    ['the date filter in its header', DATE_FILTER],
  ])('keeps its card rows with no page scope above (%s)', (_name, dateFilter) => {
    const { container } = mount(customersTable({ dateFilter }));
    expect(container.textContent).toContain('ops@acme.test');
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(markup(container)).toMatchSnapshot();
  });

  it('keeps its card rows while the flag is off', () => {
    const plain = mount(customersTable({ dateFilter: DATE_FILTER }));
    const scoped = mountInScope(customersTable({ dateFilter: DATE_FILTER }), { fill: true });
    expect(markup(scoped.container)).toBe(markup(plain.container));
  });

  it('draws the grid when the flag is on: the page’s scroll area, its own saved settings, an open action', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(customersTable({ dateFilter: DATE_FILTER }), { fill: true });

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'deviceCount', 'lastActivityDate']);
    expect(fixedViewport(container)).not.toBeNull();
    expect(settingsGear(container)).not.toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    // The second lines of the card cells sit on the row's one line.
    expect(gridBodyText(container)).toContain('Acme Corpops@acme.test');
    expect(gridBodyText(container)).toContain('5 devices12 users');
    expect(gridBodyText(container)).toContain('3/10/26 9:30 AM2h ago');
    // No email, no device count answered: the name alone, and the empty mark before the users.
    expect(gridBodyText(container)).toContain('Globex—1 user');
    // The open action in its grid form: the bare button, the column its box.
    const open = [...container.querySelectorAll('[data-grid-body] button[aria-label="Open in new tab"]')];
    expect(open).toHaveLength(2);
    expect(open.every(button => button.className.includes('border-0'))).toBe(true);
    expect(open.some(button => button.className.includes('bg-ods-card'))).toBe(false);
    // The date header is the same control, in the grid's header.
    const header = container.querySelector('[data-grid-header]');
    expect(header).not.toBeNull();
    expect(dateHeaderControl(header as Element)).toBeDefined();
  });

  it('names the plain Last Activity header when no date filter is wired', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(customersTable(), { fill: true });

    expect(gridColumns(container)).toEqual(['name', 'deviceCount', 'lastActivityDate']);
    expect(container.querySelector('[data-grid-header]')?.textContent).toContain('Last Activity');
    expect(dateHeaderControl(container)).toBeUndefined();
  });

  it('draws the first page’s loading rows in the grid: one line of bars, the open action inert', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(customersTable({ dateFilter: DATE_FILTER, isLoading: true }), { fill: true });

    expect(gridRoot(container)).not.toBeNull();
    // Every data cell is one bar on the row's line (a bar is a `span`): no card cell's two-line column, and the logo's
    // box before the name.
    expect(container.querySelectorAll('[data-grid-body] div.flex-col')).toHaveLength(0);
    expect(container.querySelectorAll('[data-grid-body] span.text-h4')).toHaveLength(60);
    expect(container.querySelectorAll('[data-grid-body] [data-part="leading"]')).toHaveLength(20);
    // A loading table names no column and offers no control.
    expect(gridColumns(container)).toEqual([null, null, null]);
    expect(dateHeaderControl(container)).toBeUndefined();
    const open = [...container.querySelectorAll<HTMLButtonElement>('[data-grid-body] button')];
    expect(open).toHaveLength(20);
    expect(open.every(button => button.disabled)).toBe(true);
  });

  it('draws its loading form while the flag is read, then the answered layout', () => {
    setTableGridFlag('loading');
    const { container } = mountInScope(customersTable({ dateFilter: DATE_FILTER }), { fill: true });
    // Not answered: a loading scope, on the card rows every screen has. No loaded row is drawn in a guessed layout.
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain('Acme Corp');

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain('Acme Corp');
  });
});

describe('A customer’s Tickets tab', () => {
  it('keeps its card rows with no page scope above', () => {
    const { container } = mount(ticketsTab());
    expect(container.textContent).toContain('Printer offline');
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(markup(container)).toMatchSnapshot();
  });

  it('keeps its card rows while the flag is off', () => {
    const plain = mount(ticketsTab());
    const scoped = mountInScope(ticketsTab());
    expect(markup(scoped.container)).toBe(markup(plain.container));
  });

  it('draws the grid when the flag is on: its own saved settings, and the page keeps the scroll', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(ticketsTab());

    expect(gridRoot(container)).not.toBeNull();
    expect(settingsGear(container)).not.toBeNull();
    // A tab is one section of the customer's page: the page scrolls, not the table.
    expect(fixedViewport(container)).toBeNull();
    expect(gridBodyText(container)).toContain('Printer offline');
    // The open action is the grid's own button on every row: no border or fill of the card row's button.
    const openButtons = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-grid-body] button[aria-label="Open in new tab"]'),
    ];
    expect(openButtons).toHaveLength(2);
    for (const button of openButtons) {
      expect(button.className).toContain('border-0');
      expect(button.className).not.toContain('bg-ods-card');
    }
  });
});
