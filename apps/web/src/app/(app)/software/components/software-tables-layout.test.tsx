/**
 * The Software module's tables, in their two layouts.
 *
 * Card rows (no page scope above, and what the app's table flag gives while it is off) are locked as markup: those
 * snapshots were recorded BEFORE the tables learned the grid layout, and that change left them untouched. Update one
 * only for a change that means to alter the card rows.
 *
 * The grid (the flag on, under a page's `TableLayoutScope`): the lib's grid table with the gear of its saved column
 * settings, the open button as an action column, and one line in every cell.
 */

import { act } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, SentinelObserver, unmountAll } from '@/app/components/shared/live-table.fixtures';
import { NO_NEXT_PAGE } from '@/app/components/shared/no-next-page';
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
import { SoftwareLogsRows } from './action-detail/software-logs-table';
import { SoftwareActionsTable } from './action-list/software-actions-table';
import { SoftwareDevicesTable } from './software-detail/devices-tab/software-devices-table';
import { SoftwareVulnerabilitiesTable } from './software-detail/vulnerabilities-tab/software-vulnerabilities-table';
import { SoftwareTable } from './software-list/software-table';
import { AffectedSoftwareTable } from './vulnerability-detail/affected-software-table';
import { VulnerabilityDevicesTable } from './vulnerability-detail/vulnerability-devices-table';
import { VulnerabilityTable } from './vulnerability-list/vulnerability-table';

// Dates print in the viewer's zone, and an age counts from today: one zone and one day, so the card snapshots read the
// same on every machine.
vi.hoisted(() => {
  process.env.TZ = 'UTC';
});

/** What the table that owns its query reads back: the test sets it before mounting that table. */
const relay = vi.hoisted(() => ({ query: {} as unknown }));

// A fragment reference IS its data here: every cell reads its row's fields from the object the test hands the table,
// and a table that owns its query reads `relay.query`.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, key: unknown) => key,
  useLazyLoadQuery: () => relay.query,
  usePaginationFragment: (_fragment: unknown, ref: unknown) => ({
    data: ref,
    loadNext: () => {},
    hasNext: false,
    isLoadingNext: false,
  }),
}));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
// The devices list maps a machine node to the shared table's row: the test hands it rows already.
vi.mock('@/app/(app)/devices/utils/device-transform', () => ({ machineRowToDevice: (node: unknown) => node }));
// A row's result panel opens a paint after it mounts: here, at once.
vi.mock('@/app/hooks/use-collapse-phase', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  afterPaint: (run: () => void) => run(),
}));
vi.mock('./action-list/use-software-action-filters', () => ({
  useSoftwareActionFilters: () => ({ actions: [], engines: [], statuses: [] }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/software',
  useSearchParams: () => new URLSearchParams(),
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(() => setTableGridFlag('off'));
afterEach(() => {
  unmountAll();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

const noop = () => {};

const SOFTWARE = [
  {
    id: 'sw-1',
    name: 'Google Chrome',
    publisher: 'Google LLC',
    currentVersion: '130.0.6723.92',
    versionStatus: 'OUTDATED',
    olderVersionsCount: 2,
    cpeMatched: true,
    vulnerabilitySummary: { cveCount: 3 },
    os: 'WINDOWS',
    source: 'CHOCOLATEY',
    autoUpdate: 'ON',
  },
  {
    id: 'sw-2',
    name: 'requests',
    publisher: null,
    currentVersion: null,
    versionStatus: 'UP_TO_DATE',
    olderVersionsCount: 0,
    cpeMatched: false,
    vulnerabilitySummary: { cveCount: 0 },
    os: null,
    source: 'UNMANAGED',
    autoUpdate: 'NEEDS_ADOPTION',
  },
];

/** The software list as a surface draws it once its first page has answered. */
function softwareTable(surface: 'fleet' | 'device') {
  return (
    <SoftwareTable
      surface={surface}
      rows={SOFTWARE as never}
      totalCount={SOFTWARE.length}
      debouncedSearch=""
      isPending={false}
      emptyState={null}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
      infiniteScroll={NO_NEXT_PAGE}
    />
  );
}

describe('Software list', () => {
  it.each(['fleet', 'device'] as const)('keeps its card rows with no page scope above (%s)', surface => {
    const { container } = mount(softwareTable(surface));
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('keeps its card rows while the flag is off', () => {
    const plain = mount(softwareTable('fleet'));
    const scoped = mountInScope(softwareTable('fleet'), { fill: true });
    expect(scoped.container.innerHTML).toBe(plain.container.innerHTML);
  });

  it('draws the grid when the flag is on: the page’s scroll area, its own saved settings, an open action', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(softwareTable('fleet'), { fill: true });

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['name', 'currentVersion', 'os', 'engine', 'autoUpdate']);
    expect(fixedViewport(container)).not.toBeNull();
    expect(settingsGear(container)).not.toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    // The second lines of the card cells sit on the row's one line.
    expect(gridBodyText(container)).toContain('Google ChromeGoogle LLC');
    expect(gridBodyText(container)).toContain('+2 older versions');
    expect(container.querySelectorAll('[data-grid-body] button[aria-label="Open in new tab"]')).toHaveLength(2);
  });

  it('keeps the two surfaces’ column layouts apart', () => {
    setTableGridFlag('on');
    const { container } = mountInScope(softwareTable('device'));

    expect(gridColumns(container)).toEqual(['name', 'currentVersion', 'cveCount']);
    // A device's tab is one section of its page: the page scrolls, not the table.
    expect(fixedViewport(container)).toBeNull();
    expect(gridBodyText(container)).toContain('3 CVEs');
    expect(gridBodyText(container)).toContain('no CPE match');
  });

  it('draws its loading form while the flag is read, then the answered layout', () => {
    setTableGridFlag('loading');
    const { container } = mountInScope(softwareTable('fleet'), { fill: true });
    // Not answered: a loading scope, on the card rows every screen has. No loaded row is drawn in a guessed layout.
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain('Google Chrome');

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toContain('Google Chrome');
  });
});

/** `edges` of a connection over the rows. */
const connection = <T,>(rows: T[]) => ({ filteredCount: rows.length, edges: rows.map(node => ({ node })) });

const SOFTWARE_DEVICES = [
  {
    status: 'OUTDATED',
    device: {
      id: 'dev-1',
      machineId: 'machine-1',
      nickname: null,
      displayName: 'Front desk',
      hostname: 'laptop-01',
      status: 'ACTIVE',
      connectivity: 'ONLINE',
      lastSeen: '2026-11-18T11:00:00.000Z',
      type: 'LAPTOP',
      organization: { name: 'Acme Corp' },
    },
    softwareVersion: '129.0.1',
    installedBy: 'CHOCOLATEY',
    autoUpdate: 'ON',
  },
  {
    status: 'UP_TO_DATE',
    device: {
      id: 'dev-2',
      machineId: '',
      nickname: null,
      displayName: null,
      hostname: 'server-02',
      status: 'ACTIVE',
      connectivity: 'OFFLINE',
      lastSeen: null,
      type: 'SERVER',
      organization: null,
    },
    softwareVersion: null,
    installedBy: null,
    autoUpdate: null,
  },
];

function softwareDevicesTable() {
  relay.query = { softwareDevices: connection(SOFTWARE_DEVICES) };
  return (
    <SoftwareDevicesTable
      softwareId="sw-1"
      backendFilters={null}
      debouncedSearch=""
      sort={null}
      sortState={null}
      onSortChange={noop}
      statusFilter={[]}
      onStatusFilterChange={noop}
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

const SOFTWARE_VULNERABILITIES = [
  { cveId: 'CVE-2026-1001', affectedVersion: '129.0.1', discoveredAt: '2026-11-08T12:00:00.000Z' },
  { cveId: 'CVE-2026-1002', affectedVersion: null, discoveredAt: null },
];

function softwareVulnerabilitiesTable() {
  relay.query = { softwareVulnerabilities: connection(SOFTWARE_VULNERABILITIES) };
  return (
    <SoftwareVulnerabilitiesTable
      softwareId="sw-1"
      debouncedSearch=""
      sort={null}
      sortState={null}
      onSortChange={noop}
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

const VULNERABILITIES = [
  { cveId: 'CVE-2026-1001', discoveredAt: '2026-11-08T12:00:00.000Z' },
  { cveId: 'CVE-2026-1002', discoveredAt: null },
];

function vulnerabilityTable() {
  return (
    <VulnerabilityTable
      rows={VULNERABILITIES as never}
      totalCount={VULNERABILITIES.length}
      debouncedSearch=""
      sortableIds={['discoveredAt']}
      sortState={null}
      onSortChange={noop}
      isPending={false}
      emptyState={null}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
      infiniteScroll={NO_NEXT_PAGE}
    />
  );
}

const AFFECTED_SOFTWARE = {
  affectedSoftware: [
    { id: 'sw-1', name: 'Google Chrome', source: 'CHOCOLATEY', version: '129.0.1', resolvedInVersion: '130.0.0' },
    { id: 'sw-2', name: 'requests', source: null, version: null, resolvedInVersion: null },
  ],
};

function affectedSoftwareTable() {
  return <AffectedSoftwareTable vulnerability={AFFECTED_SOFTWARE as never} />;
}

const VULNERABILITY_DEVICES = [
  {
    id: 'dev-1',
    machineId: 'machine-1',
    hostname: 'laptop-01',
    displayName: 'Front desk',
    status: 'ACTIVE',
    connectivity: 'ONLINE',
    type: 'LAPTOP',
    organization: 'Acme Corp',
    lastSeen: '2026-11-18T11:00:00.000Z',
    last_seen: '2026-11-18T11:00:00.000Z',
    tags: [],
  },
  { id: 'dev-2', machineId: 'machine-2', hostname: 'server-02', status: 'ACTIVE', type: 'SERVER', tags: [] },
];

function vulnerabilityDevicesTable() {
  relay.query = { vulnerabilityDevices: connection(VULNERABILITY_DEVICES) };
  return (
    <VulnerabilityDevicesTable
      cveId="CVE-2026-1001"
      debouncedSearch=""
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

const SOFTWARE_ACTIONS = [
  {
    id: 'run-1',
    software: 'googlechrome',
    kind: 'UPDATE',
    engine: 'CHOCOLATEY',
    status: 'COMPLETED',
    version: '130.0.0',
    scheduledAt: null,
    timeReference: null,
    respondedMachineCount: 8,
    totalMachineCount: 10,
  },
  {
    id: 'run-2',
    software: 'firefox',
    kind: 'INSTALL',
    engine: 'WINGET',
    status: 'SCHEDULED',
    version: null,
    scheduledAt: '2026-11-20T09:30:00.000Z',
    timeReference: 'DEVICE_LOCAL',
    respondedMachineCount: 0,
    totalMachineCount: 4,
  },
];

function softwareActionsTable() {
  relay.query = { softwareActions: connection(SOFTWARE_ACTIONS) };
  return (
    <SoftwareActionsTable
      backendFilters={null}
      debouncedSearch=""
      selections={{ action: [], engine: [], status: [] }}
      onSelectionsChange={noop}
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

const SOFTWARE_LOGS = [
  {
    machineId: 'machine-1',
    status: 'COMPLETED',
    hostname: 'laptop-01',
    deviceStatus: 'ACTIVE',
    connectivity: 'ONLINE',
    lastSeen: '2026-11-18T11:00:00.000Z',
    organizationName: 'Acme Corp',
    dispatchedAt: '2026-11-18T09:00:00.000Z',
    finishedAt: '2026-11-18T09:05:00.000Z',
  },
  {
    machineId: 'machine-2',
    status: 'SCHEDULED',
    hostname: null,
    deviceStatus: null,
    connectivity: null,
    lastSeen: null,
    organizationName: null,
    dispatchedAt: null,
    finishedAt: null,
  },
];

function softwareLogsTable() {
  return (
    <SoftwareLogsRows
      allRows={SOFTWARE_LOGS as never}
      state={
        {
          narrowSearch: '',
          isPending: false,
          tableFilters: {},
          onFilterChange: noop,
          mobileFilterOpen: false,
          onMobileFilterClose: noop,
          stickyHeaderOffset: 'top-[56px]',
          onEmptyChange: noop,
        } as never
      }
    />
  );
}

/**
 * Each table with what its grid form must show: its data columns, and text that a card row keeps on a second line.
 */
const TABLES = [
  {
    name: 'a software title’s devices',
    table: softwareDevicesTable,
    columns: ['device', 'softwareVersion', 'installedBy', 'autoUpdate'],
    oneLine: ['Acme Corp'],
    actions: 2,
  },
  {
    name: 'a software title’s vulnerabilities',
    table: softwareVulnerabilitiesTable,
    columns: ['cveId', 'affectedVersion', 'discoveredAt'],
    oneLine: ['10 days'],
    actions: 2,
  },
  {
    name: 'the vulnerability list',
    table: vulnerabilityTable,
    columns: ['cveId', 'discoveredAt'],
    oneLine: ['10 days'],
    actions: 2,
  },
  {
    name: 'a vulnerability’s affected software',
    table: affectedSoftwareTable,
    columns: ['name', 'version', 'resolvedInVersion'],
    oneLine: ['Google ChromeChocolatey'],
    actions: 2,
  },
  {
    name: 'the software actions list',
    table: softwareActionsTable,
    columns: ['software', 'action', 'engine', 'status', 'processedDevices'],
    oneLine: ['Update130.0.0', 'Device local'],
    // A run still waiting on its schedule has nothing to open.
    actions: 1,
  },
  {
    name: 'a software action’s log',
    table: softwareLogsTable,
    columns: ['device', 'customer', 'status'],
    oneLine: ['Last Online: 1h ago', '11/18/26 9:05 AM'],
    actions: 2,
  },
] as const;

/** The snapshots' names: recorded under them before the tables learned the grid. */
const CARD_TABLES = [
  ['a software title’s devices', softwareDevicesTable],
  ['a software title’s vulnerabilities', softwareVulnerabilitiesTable],
  ['the vulnerability list', vulnerabilityTable],
  ['a vulnerability’s affected software', affectedSoftwareTable],
  ['a vulnerability’s devices', vulnerabilityDevicesTable],
  ['the software actions list', softwareActionsTable],
  ['a software action’s log', softwareLogsTable],
] as const;

describe('Software tables, card rows', () => {
  it.each(CARD_TABLES)('%s keeps its card rows with no page scope above', (_name, table) => {
    const { container } = mount(table());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container.textContent).not.toBe('');
    expect(container.innerHTML).toMatchSnapshot();
  });

  it.each(CARD_TABLES)('%s keeps its card rows while the flag is off', (_name, table) => {
    const plain = mount(table());
    const scoped = mountInScope(table());
    expect(scoped.container.innerHTML).toBe(plain.container.innerHTML);
  });
});

describe('Software tables, grid layout (the flag on)', () => {
  beforeEach(() => setTableGridFlag('on'));

  it.each(TABLES)('$name draws the grid: sized columns, one line a cell, its own saved settings', spec => {
    const { container } = mountInScope(spec.table());

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(spec.columns);
    expect(settingsGear(container)).not.toBeNull();
    // A tab or a section of a longer page: the page scrolls, not the table.
    expect(fixedViewport(container)).toBeNull();
    expect(twoLineCells(container)).toHaveLength(0);
    for (const text of spec.oneLine) expect(gridBodyText(container)).toContain(text);
    expect(container.querySelectorAll('[data-grid-body] [data-no-row-click] button')).toHaveLength(spec.actions);
  });

  it('a vulnerability’s devices draws the shared devices table in its grid form', () => {
    const { container } = mountInScope(vulnerabilityDevicesTable());

    expect(gridRoot(container)).not.toBeNull();
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).toBeNull();
    expect(gridBodyText(container)).toContain('Front desk');
  });

  it('a list page’s table is the page’s scroll area', () => {
    for (const table of [vulnerabilityTable, softwareActionsTable]) {
      const { container } = mountInScope(table(), { fill: true });
      expect(fixedViewport(container)).not.toBeNull();
    }
  });

  it('a software action’s log still unfolds a row’s result under it', () => {
    const { container } = mountInScope(softwareLogsTable());
    const toggle = container.querySelector<HTMLButtonElement>('[data-grid-body] button[aria-label="Show Result"]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    act(() => toggle?.click());
    expect(container.querySelector('[data-grid-body] button[aria-label="Hide Result"]')).not.toBeNull();
    expect(container.querySelector('[data-grid-body] button[aria-expanded="true"]')).not.toBeNull();
  });

  it.each(TABLES)('$name waits for the flag: its loading form, then the answered layout', spec => {
    setTableGridFlag('loading');
    const { container } = mountInScope(spec.table());
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain(spec.oneLine[0]);

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
  });
});
