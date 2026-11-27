/**
 * The Users module's tables, in their two layouts.
 *
 * Card rows (no page scope above, and what the app's table flag gives while it is off) are locked as markup: those
 * snapshots were recorded BEFORE the tables learned the grid layout, and that change left them untouched. Update one
 * only for a change that means to alter the card rows.
 *
 * The grid (the flag on, under a page's `TableLayoutScope`): the lib's grid table with the gear of its saved column
 * settings, the row actions as action columns, and one line in every cell.
 *
 * Every table is mounted LOADED, through its own reader: the queries answer from `ANSWER` below.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { GroupMembersSection } from './group-detail/group-members-table';
import { GroupsTable } from './groups-list/groups-table';
import { UserDevicesTab } from './user-detail/user-devices-tab';
import { UserGroupsTab } from './user-detail/user-groups-tab';
import { UserLicencesTab } from './user-detail/user-licences-tab';
import { DirectoryUsersTable } from './users-list/directory-users-table';

const ACME = {
  organizationId: 'org-1',
  name: 'Acme Corp',
  image: { imageUrl: 'https://cdn.test/acme.png', hash: 'h1' },
};
const GLOBEX = { organizationId: 'org-2', name: 'Globex', image: null };
const ACME_TENANT = { name: 'Acme tenant', provider: 'MICROSOFT_365' };
const NO_NEXT = { hasNextPage: false, endCursor: null };

const LAPTOP = {
  id: 'm-1',
  machineId: 'agent-1',
  hostname: 'olivia-laptop',
  displayName: 'OLIVIA-LAPTOP',
  nickname: null,
  type: 'LAPTOP',
  status: 'ACTIVE',
  connectivity: 'ONLINE',
  lastSeen: '2026-01-15T11:40:00Z',
  osVersion: 'Windows 11 23H2',
  serialNumber: 'CND9921',
  directorySources: ['MICROSOFT_365'],
};
const DESKTOP = { ...LAPTOP, id: 'm-2', machineId: 'agent-2', hostname: 'desktop-7qk', displayName: 'DESKTOP-7QK' };

/** A directory device record as `userDevicesTab_record` selects it. */
function record(id: string, displayName: string, fields: Record<string, unknown> = {}) {
  return {
    id,
    displayName,
    source: 'MICROSOFT_365',
    sourceId: `entra:${id}`,
    operatingSystem: 'Windows',
    lastSeenAt: '2026-01-15T11:40:00Z',
    linkable: false,
    connection: ACME_TENANT,
    customers: [ACME],
    suggestions: [],
    ...fields,
  };
}

const OLIVIA_CLAIMS = [
  { organization: ACME, rule: { kind: 'GROUP' }, via: 'Finance' },
  { organization: GLOBEX, rule: null, via: null },
];

/**
 * What every query of these tables answers: one stable record (the readers keep its identity), each table reading its
 * own field of it. The first row of each list is full, the last has its optional fields empty.
 */
const ANSWER = {
  directoryUsers: {
    totalCount: 2,
    pageInfo: NO_NEXT,
    edges: [
      {
        node: {
          personKey: 'p-1',
          displayName: 'Olivia Grant',
          email: 'olivia@acme.test',
          providers: ['MICROSOFT_365'],
          status: 'ACTIVE',
          topAdmin: 'YES',
          lastSignInAt: '2026-01-15T11:55:00Z',
          licenses: [{ name: 'Microsoft 365 E3' }, { name: 'Power BI Pro' }],
          customers: OLIVIA_CLAIMS,
          accounts: [
            {
              id: 'acc-1',
              signInName: 'olivia@acme.test',
              source: 'MICROSOFT_365',
              status: 'ACTIVE',
              statusReason: 'NEVER_SIGNED_IN',
              statusDetail: null,
              topAdmin: 'YES',
              signInData: 'READ',
              connection: ACME_TENANT,
              devices: {
                managed: [
                  {
                    machine: { displayName: 'OLIVIA-LAPTOP', hostname: 'olivia-laptop' },
                    directoryDevice: { displayName: 'OLIVIA-LAPTOP' },
                  },
                ],
                unmanaged: [{ directoryDevice: { displayName: 'Olivia iPhone' } }],
              },
            },
          ],
        },
      },
      {
        // A person no account explains: nothing to open, no mailbox, no customer, no device, no licence.
        node: {
          personKey: 'p-2',
          displayName: 'Sam Reed',
          email: null,
          providers: [],
          status: 'SUSPENDED',
          topAdmin: 'NO',
          lastSignInAt: null,
          licenses: [],
          customers: [],
          accounts: [],
        },
      },
    ],
  },
  directoryUserFilters: {
    customers: [{ value: 'org-1', label: 'Acme Corp', count: 1 }],
    statuses: [{ value: 'ACTIVE', label: 'Active', count: 1 }],
    licenses: [{ value: 'sku-1', label: 'Microsoft 365 E3', count: 1 }],
  },
  directoryAccount: {
    source: 'MICROSOFT_365',
    devices: {
      managed: [{ machine: LAPTOP, directoryDevice: record('dev-1', 'OLIVIA-LAPTOP') }],
      unmanaged: [
        // Can carry an agent, and one machine looks like it: a row of Suggested Devices too.
        {
          directoryDevice: record('dev-2', 'DESKTOP-7QK', {
            linkable: true,
            suggestions: [{ matchedKeys: ['HOSTNAME', 'OS'], machine: DESKTOP }],
          }),
        },
        {
          directoryDevice: record('dev-3', 'LAB-PC', {
            lastSeenAt: null,
            linkable: true,
            suggestions: [{ matchedKeys: ['SERIAL_NUMBER'], machine: LAPTOP }],
          }),
        },
        // A phone: no agent runs on it, and the provider says nothing more.
        {
          directoryDevice: record('dev-4', 'Olivia iPhone', {
            sourceId: 'intune:dev-4',
            operatingSystem: null,
            lastSeenAt: null,
            customers: [],
          }),
        },
      ],
    },
    groups: {
      totalCount: 2,
      pageInfo: NO_NEXT,
      edges: [
        {
          node: {
            id: 'g-1',
            name: 'Finance',
            provider: 'MICROSOFT_365',
            memberCount: 12,
            feed: 'PUSH',
            connection: { name: 'Acme tenant' },
          },
        },
        {
          node: {
            id: 'g-2',
            name: 'All staff',
            provider: 'GOOGLE_WORKSPACE',
            memberCount: 0,
            feed: 'POLLING',
            connection: { name: 'Globex Workspace' },
          },
        },
      ],
    },
    licenses: [
      { skuId: 'sku-1', name: 'Microsoft 365 E3', assignedDirectly: true, viaGroups: [{ id: 'g-1', name: 'Finance' }] },
      { skuId: 'sku-2', name: 'Power BI Pro', assignedDirectly: false, viaGroups: [{ id: 'g-9', name: null }] },
      { skuId: 'sku-3', name: 'Visio Plan 2', assignedDirectly: true, viaGroups: [] },
    ],
  },
  directoryGroups: {
    totalCount: 2,
    pageInfo: NO_NEXT,
    edges: [
      {
        node: {
          id: 'g-1',
          name: 'Finance',
          provider: 'MICROSOFT_365',
          memberCount: 12,
          feed: 'PUSH',
          connection: { name: 'Acme tenant' },
        },
      },
      {
        node: {
          id: 'g-2',
          name: 'All staff',
          provider: 'GOOGLE_WORKSPACE',
          memberCount: 0,
          feed: 'AUDIT_STREAM',
          connection: { name: 'Globex Workspace' },
        },
      },
    ],
  },
  directoryGroup: {
    provider: 'MICROSOFT_365',
    members: {
      totalCount: 5,
      hiddenMemberCount: 2,
      externalMemberCount: 1,
      liveDataUnavailable: false,
      pageInfo: NO_NEXT,
      edges: [
        {
          node: {
            viaGroup: { name: 'Finance leads' },
            member: {
              __typename: 'DirectoryAccount',
              id: 'acc-1',
              displayName: 'Olivia Grant',
              email: 'olivia@acme.test',
              signInName: 'olivia@acme.test',
              source: 'MICROSOFT_365',
              topAdmin: 'YES',
              customers: OLIVIA_CLAIMS,
              licenses: [{ name: 'Microsoft 365 E3' }, { name: 'Power BI Pro' }],
            },
          },
        },
        {
          node: {
            viaGroup: null,
            member: {
              __typename: 'DirectoryAccount',
              id: 'acc-2',
              displayName: 'Sam Reed',
              email: null,
              signInName: null,
              source: 'OPENFRAME',
              topAdmin: 'NO',
              customers: [],
              licenses: [],
            },
          },
        },
        {
          node: {
            viaGroup: null,
            member: {
              __typename: 'DirectoryGroup',
              id: 'g-7',
              name: 'Contractors',
              provider: 'MICROSOFT_365',
              groupKind: 'SECURITY',
            },
          },
        },
        {
          node: {
            viaGroup: null,
            member: {
              __typename: 'OrgDevice',
              id: 'dev-1',
              displayName: 'OLIVIA-LAPTOP',
              deviceSource: 'MICROSOFT_365',
              deviceSourceId: 'entra:dev-1',
              deviceCustomers: [ACME],
              machineLink: { machine: { machineId: 'agent-1' } },
            },
          },
        },
        {
          // A record no agent machine is linked to: nothing to open.
          node: {
            viaGroup: null,
            member: {
              __typename: 'OrgDevice',
              id: 'dev-4',
              displayName: 'Olivia iPhone',
              deviceSource: 'MICROSOFT_365',
              deviceSourceId: 'intune:dev-4',
              deviceCustomers: [],
              machineLink: null,
            },
          },
        },
      ],
    },
  },
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
  // The auto-refresh's refetch (`useRefetchPage`): never called here, only built.
  useRelayEnvironment: () => ({}),
  fetchQuery: () => ({ toPromise: () => Promise.resolve() }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/users',
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
  // "Last sign-in: 5 min", "last seen 20 minutes ago": the rows count from now.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-15T12:00:00Z') });
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
const NO_SELECTIONS = { customer: [], status: [], license: [] };

/** The Users list as its view draws it; with a customer, that customer's Users tab. */
function usersTable(organizationId?: string) {
  return (
    <DirectoryUsersTable
      organizationId={organizationId}
      backendFilters={null}
      debouncedSearch=""
      selections={NO_SELECTIONS}
      onSelectionsChange={noop}
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
      filtersOpen={false}
      onFiltersClose={noop}
    />
  );
}

/** A customer's Groups tab. */
function groupsTable() {
  return (
    <GroupsTable
      organizationId="org-1"
      orderBy={null}
      debouncedSearch=""
      membersSort="desc"
      onToggleMembersSort={noop}
      isPending={false}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

/** Every table of the module, as its host mounts it. */
const TABLES: Record<string, () => ReactElement> = {
  'directory users': () => usersTable(),
  'customer users': () => usersTable('org-1'),
  'user devices': () => <UserDevicesTab id="acc-1" />,
  'user groups': () => <UserGroupsTab id="acc-1" />,
  'user licences': () => <UserLicencesTab id="acc-1" />,
  groups: groupsTable,
  'group members': () => <GroupMembersSection id="g-1" customerId="org-1" />,
};
const TABLE_NAMES = Object.keys(TABLES);

/**
 * A mounted table's markup, with React's generated ids (a hint's `aria-describedby`) levelled: they count every id the
 * tests before made, so they say nothing about the table.
 */
const markup = (container: Element) => container.innerHTML.replace(/_r_[0-9a-z]+_/g, '_r_');

describe('Users tables, card rows', () => {
  it.each(TABLE_NAMES)('keeps its card rows with no page scope above (%s)', name => {
    const { container } = mount(TABLES[name]());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(markup(container)).toMatchSnapshot();
  });

  it.each(TABLE_NAMES)('keeps its card rows while the flag is off (%s)', name => {
    const plain = mount(TABLES[name]());
    const scoped = mountInScope(TABLES[name](), { fill: name === 'directory users' });
    expect(markup(scoped.container)).toBe(markup(plain.container));
  });
});

/** The buttons of a grid table's rows with this accessible name. */
const bodyButtons = (scope: ParentNode, label: string) =>
  scope.querySelectorAll(`[data-grid-body] button[aria-label="${label}"]`);

/** Mounts a table under its page's scope with the flag on, and checks what every grid table of the module draws. */
function mountGrid(name: string, options?: { fill?: boolean }) {
  setTableGridFlag('on');
  const { container } = mountInScope(TABLES[name](), options);
  for (const root of container.querySelectorAll('[data-grid-root]')) {
    expect(settingsGear(root)).not.toBeNull();
    // Every card cell's second line is on the row's one line.
    expect(twoLineCells(root)).toHaveLength(0);
  }
  return container;
}

describe('Users tables, the grid', () => {
  it('draws the Users list as the page’s scroll area, with its own saved settings and an open action', () => {
    const container = mountGrid('directory users', { fill: true });

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['user', 'customer', 'devices', 'status']);
    expect(fixedViewport(container)).not.toBeNull();
    const body = gridBodyText(container);
    // The name, the role tag and the address on one line; the customer with the others counted, then the tenant.
    expect(body).toContain('Olivia GrantGlobal adminolivia@acme.test');
    expect(body).toContain('Acme Corp+1Acme tenant');
    expect(body).toContain('OLIVIA-LAPTOP+1');
    expect(body).toContain('ActiveLast sign-in: 5 min');
    // A person no account explains: every cell has its empty form, and there is no open button, as in the card row.
    expect(body).toContain('Sam Reed—');
    expect(body).toContain('—Added in OpenFrame');
    expect(body).toContain('SuspendedLast sign-in: Never');
    expect(bodyButtons(container, 'Open Olivia Grant in new tab')).toHaveLength(1);
    expect(bodyButtons(container, 'Open Sam Reed in new tab')).toHaveLength(0);
    // The row still links to the user's page.
    expect(container.querySelector('[data-grid-body] a[href*="acc-1"]')).not.toBeNull();
  });

  it('keeps a customer’s Users tab apart: its own columns, and the page scrolls', () => {
    const container = mountGrid('customer users');

    expect(gridColumns(container)).toEqual(['user', 'devices', 'status', 'license']);
    expect(fixedViewport(container)).toBeNull();
    expect(gridBodyText(container)).toContain('Microsoft 365 E3+1');
    expect(bodyButtons(container, 'Open Olivia Grant in new tab')).toHaveLength(1);
  });

  /** Each table's saved column layout: its storage key, a data column to hide through it, and which grid it is. */
  const SAVED_LAYOUTS: [name: string, storageKey: string, hidden: string, grid: number][] = [
    ['directory users', 'directory-users', 'devices', 0],
    ['customer users', 'customer-users', 'devices', 0],
    ['user devices', 'user-devices', 'os', 0],
    ['user devices', 'user-device-matches', 'why', 1],
    ['user groups', 'user-groups', 'feed', 0],
    ['user licences', 'user-licences', 'assignment', 0],
    ['groups', 'groups', 'feed', 0],
    ['group members', 'group-members', 'type', 0],
  ];
  const saveHidden = (storageKey: string, hidden: string) =>
    window.localStorage.setItem(
      `ods-data-table:${storageKey}`,
      JSON.stringify({ version: 1, order: [], hidden: [hidden], sizing: {} }),
    );

  it.each(SAVED_LAYOUTS)('reads the viewer’s saved columns of %s under "%s"', (name, storageKey, hidden, grid) => {
    saveHidden(storageKey, hidden);
    const container = mountGrid(name);
    expect(gridColumns(container.querySelectorAll('[data-grid-root]')[grid])).not.toContain(hidden);
  });

  it('keeps the saved layouts of the two tables of a user’s Devices tab apart', () => {
    // Both tables have a `device` column: hidden in one, it stays in the other.
    saveHidden('user-device-matches', 'device');
    const [devices, matches] = mountGrid('user devices').querySelectorAll('[data-grid-root]');
    expect(gridColumns(devices)).toEqual(['device', 'status', 'os', 'customer']);
    expect(gridColumns(matches)).toEqual(['match', 'why']);
  });

  it('keeps the two Users column sets’ saved layouts apart', () => {
    saveHidden('directory-users', 'devices');
    expect(gridColumns(mountGrid('customer users'))).toContain('devices');
  });

  it('draws a user’s devices and their possible matches, each action a column of its own', () => {
    const container = mountGrid('user devices');
    const [devices, matches] = container.querySelectorAll('[data-grid-root]');

    expect(gridColumns(devices)).toEqual(['device', 'status', 'os', 'customer']);
    expect(fixedViewport(devices)).toBeNull();
    const body = gridBodyText(devices);
    expect(body).toContain('OLIVIA-LAPTOPolivia-laptop');
    expect(body).toContain('DESKTOP-7QKEntra ID, last seen 20 minutes ago');
    expect(body).toContain('Olivia iPhoneIntune');
    expect(body).toContain('Acme CorpAcme tenant');
    // Open: live on the machine's row, inert on a record no machine is linked to.
    const open = bodyButtons(devices, 'Open OLIVIA-LAPTOP in new tab');
    expect(open).toHaveLength(1);
    expect((open[0] as HTMLButtonElement).disabled).toBe(false);
    expect((bodyButtons(devices, 'Open Olivia iPhone in new tab')[0] as HTMLButtonElement).disabled).toBe(true);
    // Link: only on a record that can carry an agent.
    expect(bodyButtons(devices, 'Link DESKTOP-7QK')).toHaveLength(1);
    expect(bodyButtons(devices, 'Link LAB-PC')).toHaveLength(1);
    expect(bodyButtons(devices, 'Link Olivia iPhone')).toHaveLength(0);

    expect(gridColumns(matches)).toEqual(['device', 'match', 'why']);
    const matchesBody = gridBodyText(matches);
    expect(matchesBody).toContain('DESKTOP-7QKEntra ID, last seen 20 minutes ago');
    expect(matchesBody).toContain('DESKTOP-7QKManaged by OpenFrame');
    expect(matchesBody).toContain('Hostname, OS');
    // The phone's second line ("May be …") belongs to the card rows, which have no match column there.
    expect(matchesBody).not.toContain('May be');
    expect(bodyButtons(matches, 'Link DESKTOP-7QK')).toHaveLength(1);
    expect(bodyButtons(matches, 'Link LAB-PC')).toHaveLength(1);
  });

  it('opens the Link window from a grid row’s action', () => {
    const container = mountGrid('user devices');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    const link = bodyButtons(container, 'Link DESKTOP-7QK')[0];
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('DESKTOP-7QK');
  });

  it.each(['user groups', 'groups'])('draws the %s list with the tenant on the group’s line', name => {
    const container = mountGrid(name);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['group', 'members', 'feed']);
    expect(fixedViewport(container)).toBeNull();
    const body = gridBodyText(container);
    expect(body).toContain('FinanceAcme tenant');
    expect(body).toContain('All staffGlobex Workspace');
    expect(body).toContain('12');
    expect(body).toContain('Live');
    expect(bodyButtons(container, 'Open Finance in new tab')).toHaveLength(1);
    expect(bodyButtons(container, 'Open All staff in new tab')).toHaveLength(1);
  });

  it('draws a user’s licences with the assignment tags on one line', () => {
    const container = mountGrid('user licences');

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['licence', 'assignment']);
    const body = gridBodyText(container);
    expect(body).toContain('Microsoft 365 E3DirectVia group');
    expect(body).toContain('Power BI ProVia group');
    expect(body).toContain('Visio Plan 2Direct');
    // The card rows' action gutter is the gear's column: no button in a row.
    expect(container.querySelectorAll('[data-grid-body] button')).toHaveLength(0);
  });

  it('draws a group’s members: users, subgroups and devices, each on one line', () => {
    const container = mountGrid('group members');

    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(['member', 'type', 'customer', 'licences']);
    expect(fixedViewport(container)).toBeNull();
    const body = gridBodyText(container);
    expect(body).toContain('Olivia GrantGlobal adminolivia@acme.test');
    expect(body).toContain('Uservia Finance leads');
    expect(body).toContain('Acme Corp+1');
    expect(body).toContain('Microsoft 365 E3+1');
    expect(body).toContain('ContractorsSecurity group, nested');
    expect(body).toContain('Counted through its members');
    expect(body).toContain('OLIVIA-LAPTOPEntra device');
    expect(body).toContain('Olivia iPhoneIntune device');
    // A member's customers carry no tenant line here.
    expect(body).not.toContain('Added in OpenFrame');
    expect(bodyButtons(container, 'Open Olivia Grant in new tab')).toHaveLength(1);
    expect(bodyButtons(container, 'Open Contractors in new tab')).toHaveLength(1);
    // A record no machine is linked to opens nothing: no button, as in its card row.
    expect(bodyButtons(container, 'Open OLIVIA-LAPTOP in new tab')).toHaveLength(1);
    expect(bodyButtons(container, 'Open Olivia iPhone in new tab')).toHaveLength(0);
    // What sits around the table stays: the members outside the customer, the external ones.
    expect(container.textContent).toContain('2 members outside this customer');
    expect(container.textContent).toContain('1 external member');
  });

  it.each(TABLE_NAMES)('draws its loading form while the flag is read, then the answered layout (%s)', name => {
    setTableGridFlag('loading');
    const { container } = mountInScope(TABLES[name](), { fill: name === 'directory users' });
    // Not answered: a loading scope, on the card rows every screen has. No loaded row is drawn in a guessed layout.
    expect(gridRoot(container)).toBeNull();
    for (const loaded of ['Olivia', 'Finance', 'Microsoft 365 E3', 'DESKTOP-7QK']) {
      expect(container.textContent).not.toContain(loaded);
    }

    act(() => setTableGridFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(gridBodyText(container)).toMatch(/Olivia|Finance|Microsoft 365 E3/);
  });

  it.each(TABLE_NAMES)('draws its own loading rows in the grid while its rows are read (%s)', name => {
    setTableGridFlag('on');
    const { container } = mountInScope(<LoadingScope>{TABLES[name]()}</LoadingScope>);
    // The grid's rows with every cell in its loading form: no row text, nothing to press, and one text bar at most in
    // a cell (the lib's bar is the one `flex-col` a loading cell holds: a second one would be a second line).
    expect(gridRoot(container)).not.toBeNull();
    const cells = [...container.querySelectorAll('[data-grid-body] [data-grid-col]')];
    expect(cells.length).toBeGreaterThan(0);
    expect(gridBodyText(container)).toBe('');
    expect(cells.filter(cell => cell.querySelectorAll('.flex-col').length > 1)).toHaveLength(0);
    expect(container.querySelectorAll('[data-grid-body] button:not([disabled])')).toHaveLength(0);
  });
});
