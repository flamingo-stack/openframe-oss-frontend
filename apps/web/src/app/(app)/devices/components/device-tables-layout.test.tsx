/**
 * The tables of a device's page and of the remote sessions screen, in their two layouts.
 *
 * Card rows (the default, and what the app's table flag gives while it is off) are locked as markup: those snapshots
 * were recorded on `main` BEFORE the tables learned the grid layout, and that change left them untouched. Update one
 * only for a change that means to alter the card rows.
 *
 * The grid (`tableLayout="grid"`): the lib's grid table with the gear of its saved column settings, one action column
 * per row action, a one-line cell in every data column, and loading rows that draw bars rather than blanks.
 */

import { DataTable, LoadingWhen, useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import type { Device } from '../types/device.types';
import type { RecordingSummary } from '../types/session-recording';
import type { RecordingTicket } from './remote-sessions/recording-tickets';
import { RecordingTicketsSection } from './remote-sessions/recording-tickets-section';
import { remoteSessionColumns } from './remote-sessions/remote-session-columns';
import { type TenantSessionRow, tenantSessionColumns } from './remote-sessions/tenant-session-columns';
import { FleetSoftwareTab } from './tabs/fleet-software-tab';
import { FleetVulnerabilitiesTab } from './tabs/fleet-vulnerabilities-tab';
import { UsersTab } from './tabs/users-tab';

// Dates and times print in the viewer's zone: one zone, so the card snapshots read the same on every machine.
const zone = vi.hoisted(() => {
  const before = process.env.TZ;
  process.env.TZ = 'UTC';
  return { before };
});

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/devices/details',
  useSearchParams: () => new URLSearchParams(),
}));
// `@inline` fragments are read with `readInlineData`; nothing here reads one.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn() }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://tenant.example' } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 'top-[56px]' }),
}));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

const NOW = new Date('2026-11-12T12:00:00.000Z');

const DEVICE = {
  id: 'mongo-1',
  machineId: 'machine-1',
  hostname: 'laptop-01',
  users: [
    { username: 'roman', uid: 501, type: 'person', groupname: 'staff', shell: '/bin/zsh', isLoggedIn: true },
    { username: '_spotlight', uid: 89, type: 'service', groupname: '_spotlight', shell: '/usr/bin/false' },
    { username: 'guest' },
  ],
  software: [
    {
      id: 1,
      name: 'Google Chrome',
      version: '130.0.6723.92',
      source: 'apps',
      vendor: 'Google',
      vulnerabilities: [
        {
          cve: 'CVE-2026-1001',
          details_link: 'https://nvd.nist.gov/vuln/detail/CVE-2026-1001',
          created_at: '2026-10-01T12:00:00.000Z',
          cvss_score: 9.1,
        },
        { cve: 'CVE-2026-1002', details_link: '', created_at: '2026-11-10T12:00:00.000Z', cvss_score: null },
      ],
      installed_paths: ['/Applications/Google Chrome.app'],
      last_opened_at: '2026-11-11T12:00:00.000Z',
    },
    { id: 2, name: 'requests', version: '', source: 'python_packages', vulnerabilities: [], installed_paths: [] },
  ],
} as unknown as Device;

const TICKETS: RecordingTicket[] = [
  {
    id: 't-1',
    ticketNumber: 3891,
    title: 'Page not found error',
    statusName: 'TODO',
    statusKind: 'CUSTOM',
    statusColor: '#2890FA',
    assignedName: 'Roman Smith',
    assignedAvatarUrl: 'https://cdn.example/roman.png',
    createdAt: '2026-11-12T11:00:00.000Z',
  },
  {
    id: 't-2',
    ticketNumber: 3902,
    title: 'Printer offline',
    statusName: 'Tech Required',
    statusKind: 'TECH_REQUIRED',
    statusColor: null,
    assignedName: null,
    assignedAvatarUrl: null,
    createdAt: null,
  },
];

const SESSION: RecordingSummary = {
  id: 's-1',
  deviceId: 'machine-1',
  startedAt: '2026-11-10T09:30:00.000Z',
  durationMs: 754_000,
  sizeBytes: 5_242_880,
  protocol: 2,
  recordingState: 'ready',
  live: false,
  kept: false,
  keep: null,
  expiresAt: '2026-11-12T18:00:00.000Z',
  recordingId: 'rec-1',
  employee: { name: 'Jerome Park', role: 'Admin' },
  technicianId: 'u-1',
};
const SESSIONS: RecordingSummary[] = [
  SESSION,
  {
    ...SESSION,
    id: 's-2',
    startedAt: '2026-11-09T14:05:00.000Z',
    kept: true,
    keep: {
      keptBy: 'Roman Smith',
      keptAt: '2026-11-09T15:00:00.000Z',
      reason: 'OTHER',
      note: 'Legal hold until the audit closes',
      dueAt: null,
      expiresAtOnRelease: null,
    },
    expiresAt: null,
    employee: { name: 'Roman Smith' },
  },
  { ...SESSION, id: 's-3', startedAt: '2026-10-01T08:00:00.000Z', recordingState: 'expired', expiresAt: null },
  {
    ...SESSION,
    id: 's-4',
    startedAt: '2026-11-12T11:55:00.000Z',
    durationMs: null,
    sizeBytes: null,
    recordingState: 'processing',
    live: true,
    expiresAt: null,
    recordingId: null,
  },
];
const TENANT_SESSIONS: TenantSessionRow[] = SESSIONS.map((session, index) => ({
  ...session,
  device: index === 2 ? null : { machineId: 'machine-1', name: 'Romans-MacBook-Pro', hostname: 'romans-mbp.local' },
  customer: index === 1 ? null : { id: 'org-1', name: 'Green Valley Manufacturing', logoUrl: null },
}));

const DATE_FILTER = { sortDirection: 'desc' as const, range: undefined, onApply: () => {} };
const sessionHandlers = { onOpen: vi.fn(), onDelete: vi.fn() };

/** The device tab's session columns in a bare table: what `RemoteSessionsTab` draws, without its recordings query. */
function DeviceSessionsTable({ layout }: { layout: TableLayout }) {
  const columns = remoteSessionColumns<RecordingSummary>({
    dateFilter: DATE_FILTER,
    employeeOptions: [],
    now: NOW.getTime(),
    liveRows: null,
    layout,
    ...sessionHandlers,
  });
  const table = useDataTable<RecordingSummary>({ data: SESSIONS, columns, getRowId: row => row.id });
  return (
    <DataTable table={table} layout={layout}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

/** The tenant list's session columns in a bare table: what `TenantSessionsShell` draws, without its Relay query. */
function TenantSessionsTable({ layout }: { layout: TableLayout }) {
  const columns = tenantSessionColumns({
    dateFilter: DATE_FILTER,
    deviceOptions: [],
    customerOptions: [],
    optionsPending: false,
    now: NOW.getTime(),
    liveRows: null,
    layout,
    ...sessionHandlers,
  });
  const table = useDataTable<TenantSessionRow>({ data: TENANT_SESSIONS, columns, getRowId: row => row.id });
  return (
    <DataTable table={table} layout={layout}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => root.render(node));
  return container;
}

const gridRoot = () => container.querySelector('[data-grid-root]');
const gear = () => container.querySelector('[aria-label="Table settings"]');
/** The ids of the grid's DATA columns, in the order the header draws them (an action column carries no id). */
const gridColumns = () => [
  ...new Set(Array.from(container.querySelectorAll('[data-grid-col]'), cell => cell.getAttribute('data-grid-col'))),
];
/** The body cells of one grid column, as text. */
const columnTexts = (id: string) =>
  Array.from(container.querySelectorAll(`[data-grid-col="${id}"]`), cell => cell.textContent ?? '').slice(1);
const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const buttons = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(`button[aria-label="${label}"]`));

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = zone.before;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const noop = () => {};

describe('card rows (the default layout): the markup recorded before the grid', () => {
  const cards = (node: ReactNode) => {
    const drawn = render(node);
    expect(drawn.innerHTML).not.toContain('data-grid-');
    expect(gear()).toBeNull();
    return drawn;
  };

  it('Device > Users', () => {
    expect(cards(<UsersTab device={DEVICE} />)).toMatchSnapshot();
  });

  it('Device > Users, loading', () => {
    expect(
      cards(
        <LoadingWhen loading>
          <UsersTab device={null} />
        </LoadingWhen>,
      ),
    ).toMatchSnapshot();
  });

  it('Device > Software (Fleet)', () => {
    expect(cards(<FleetSoftwareTab device={DEVICE} />)).toMatchSnapshot();
  });

  it('Device > Vulnerabilities (Fleet)', () => {
    expect(cards(<FleetVulnerabilitiesTab device={DEVICE} />)).toMatchSnapshot();
  });

  it('Device > Remote sessions: the columns', () => {
    expect(cards(<DeviceSessionsTable layout="cards" />)).toMatchSnapshot();
  });

  it('Remote Sessions list: the columns', () => {
    expect(cards(<TenantSessionsTable layout="cards" />)).toMatchSnapshot();
  });

  it('Recording > Assigned tickets', () => {
    expect(cards(<RecordingTicketsSection tickets={TICKETS} onUnassign={noop} />)).toMatchSnapshot();
  });
});

describe('the grid layout', () => {
  /** No grid cell stacks two lines: a card cell's `flex-col` never reaches the grid. */
  const expectOneLineCells = () =>
    expect(container.querySelectorAll('[data-grid-root] [data-grid-col] .flex-col')).toHaveLength(0);

  it('Device > Users: every column, the role beside the name, the gear', () => {
    render(<UsersTab device={DEVICE} tableLayout="grid" />);
    expect(gridRoot()).not.toBeNull();
    expect(gear()).not.toBeNull();
    expect(gridColumns()).toEqual(['username', 'uid', 'type', 'groupname', 'shell', 'status']);
    expect(columnTexts('username')).toEqual(['romanActive session', '_spotlightservice account', 'guestSystem user']);
    expect(columnTexts('type')).toEqual(['Person', 'Service', '—']);
    expect(columnTexts('status')).toEqual(['ACTIVE', '—', '—']);
    expectOneLineCells();
  });

  it('Device > Users, loading: the grid with its loading rows, no blank or broken cell', () => {
    render(
      <LoadingWhen loading>
        <UsersTab device={null} tableLayout="grid" />
      </LoadingWhen>,
    );
    expect(gridRoot()).not.toBeNull();
    // Ten loading rows under the header, each cell its own bar: no text, and no role beside a name not read yet.
    // Ten loading rows, each cell its own bar: no text, and no role beside a name not read yet. The loading header
    // names no column.
    const cells = Array.from(container.querySelectorAll('[data-grid-col="username"]'));
    expect(cells).toHaveLength(10);
    expect(cells.map(cell => cell.textContent).join('')).toBe('');
    expect(container.querySelector('[data-grid-header-loading]')).not.toBeNull();
    expect(container.textContent).not.toContain('undefined');
  });

  it('Device > Software (Fleet): the version beside the title', () => {
    render(<FleetSoftwareTab device={DEVICE} tableLayout="grid" />);
    expect(gridRoot()).not.toBeNull();
    expect(gear()).not.toBeNull();
    expect(gridColumns()).toEqual(['name', 'source', 'vulnerabilities', 'file_path', 'last_opened_at']);
    expect(columnTexts('name')).toEqual(['Google Chrome130.0.6723.92', 'requests']);
    expect(columnTexts('source')).toEqual(['Application', 'Python Package']);
    expect(columnTexts('file_path')).toEqual(['/Applications/Google Chrome.app', '—']);
    expectOneLineCells();
  });

  it('Device > Vulnerabilities (Fleet): the package in its own column, the age beside the date, open as an action', () => {
    render(<FleetVulnerabilitiesTab device={DEVICE} tableLayout="grid" />);
    expect(gridRoot()).not.toBeNull();
    expect(gear()).not.toBeNull();
    expect(gridColumns()).toEqual(['cve', 'severity', 'software_name', 'created_at']);
    expect(columnTexts('cve')).toEqual(['CVE-2026-1001', 'CVE-2026-1002']);
    expect(columnTexts('software_name')).toEqual(['Google Chrome130.0.6723.92', 'Google Chrome130.0.6723.92']);
    expect(columnTexts('created_at')).toEqual(['10/1/2642 days', '11/10/262 days']);
    // A CVE with no details link keeps its action column: the button is drawn and inert.
    expect(button('Open CVE-2026-1001 details')?.disabled).toBe(false);
    expect(button('Open CVE-2026-1002 details')?.disabled).toBe(true);
    expectOneLineCells();
  });

  it('Device > Remote sessions: Delete and Open are a column each, each cell one line', () => {
    render(<DeviceSessionsTable layout="grid" />);
    expect(gridColumns()).toEqual(['session', 'employee', 'duration', 'expires']);
    // Two action cells in a row, one button each: the card rows' one cell with both buttons is not drawn.
    expect(container.querySelectorAll('[data-grid-root] [data-no-row-click] > [data-no-row-click]')).toHaveLength(8);
    expect(columnTexts('employee')).toEqual([
      'JPJerome ParkAdmin',
      'RSRoman Smith',
      'JPJerome ParkAdmin',
      'JPJerome ParkAdmin',
    ]);
    expect(columnTexts('expires')[1]).toBe('Keptby Roman Smith · Legal hold until the audit closes');
    expect(columnTexts('expires')[2]).toBe('Expired');
    expect(columnTexts('duration')[3]).toBe('—');
    expectOneLineCells();

    const deletes = buttons('Delete session');
    // A kept session and one still processing cannot be deleted.
    expect(deletes.map(control => control.disabled)).toEqual([false, true, false, true]);
    act(() => deletes[0].click());
    expect(sessionHandlers.onDelete).toHaveBeenCalledWith(SESSIONS[0]);

    act(() => buttons('Open session recording')[0].click());
    expect(sessionHandlers.onOpen).toHaveBeenCalledWith(SESSIONS[0]);
  });

  it('Device > Remote sessions: a recording that is gone reads muted', () => {
    render(<DeviceSessionsTable layout="grid" />);
    const sessions = Array.from(container.querySelectorAll('[data-grid-col="session"]')).slice(1);
    expect(sessions[2].querySelector('.truncate')?.className).toContain('text-ods-text-secondary');
    expect(sessions[0].querySelector('.truncate')?.className).toContain('text-ods-text-primary');
  });

  it('Remote Sessions list: the device and the customer on one line, the same two action columns', () => {
    render(<TenantSessionsTable layout="grid" />);
    expect(gridColumns()).toEqual(['session', 'device', 'customer', 'expires']);
    expect(buttons('Delete session')).toHaveLength(4);
    expect(buttons('Open session recording')).toHaveLength(4);
    expect(columnTexts('device')).toEqual([
      'Romans-MacBook-Proromans-mbp.local',
      'Romans-MacBook-Proromans-mbp.local',
      '—',
      'Romans-MacBook-Proromans-mbp.local',
    ]);
    expect(columnTexts('customer')[1]).toBe('—');
    expect(columnTexts('customer')[0]).toContain('Green Valley Manufacturing');
    expectOneLineCells();
  });

  it('Recording > Assigned tickets: Unassign and Open are a column each, the count above the table', () => {
    const onUnassign = vi.fn();
    render(<RecordingTicketsSection tickets={TICKETS} onUnassign={onUnassign} tableLayout="grid" />);
    expect(gridRoot()).not.toBeNull();
    expect(gear()).not.toBeNull();
    expect(gridColumns()).toEqual(['ticket', 'assigned', 'status']);
    expect(container.querySelectorAll('[data-grid-root] [data-no-row-click] > [data-no-row-click]')).toHaveLength(4);
    expect(columnTexts('ticket')[1]).toBe('Printer offline3902');
    expect(columnTexts('assigned')).toEqual(['RSRoman Smith', '—']);
    expect(container.textContent).toContain('2 results');
    expectOneLineCells();

    act(() => buttons('Unassign ticket')[1].click());
    expect(onUnassign).toHaveBeenCalledWith(TICKETS[1]);
    act(() => buttons('Open ticket')[0].click());
    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('t-1'));
  });
});
