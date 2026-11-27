/**
 * The directory's tables read one page per request, the cursor in the URL: the Users page and a customer's Users tab,
 * a customer's Groups tab, a group's members and a user's Groups tab. Every one pages forward only (`first` /
 * `after`). Over the real views, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range over the server's total
 * - the URL's cursor is sent as `after`, and labels the range with the URL's page
 * - a table in another page's tab reads its keys under its prefix (`usersCursor`, `groupsCursor`, `membersCursor`),
 *   never the page's own or a sibling tab's: the customer page keeps every key when the tab changes
 * - a change to a search, a funnel, the sort or the scope drops the cursor in the same URL write (one history entry)
 * - a change marked on the list (an edit, a suspend) reads the page again (a paged list has no connection to edit)
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerTableFlag, stubLayoutApis } from '@/app/hooks/use-table-layout.fixtures';
import { markListChanged } from '@/lib/list-refresh';

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
// The phone's filter window draws its options in a dialog: here, one button per option that applies it alone.
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  FilterModal: ({
    isOpen,
    filterGroups,
    onFilterChange,
  }: {
    isOpen: boolean;
    filterGroups: { id: string; options: { label: string; value: string }[] }[];
    onFilterChange: (filters: Record<string, string[]>) => void;
  }) =>
    isOpen ? (
      <>
        {filterGroups.flatMap(group =>
          group.options.map(option => (
            <button key={`${group.id}:${option.value}`} onClick={() => onFilterChange({ [group.id]: [option.value] })}>
              {`Pick ${option.label}`}
            </button>
          )),
        )}
      </>
    ) : null,
}));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/directoryUsersTableQuery.graphql'),
    import('@/__generated__/useUserFiltersQuery.graphql'),
    import('@/__generated__/groupsTableQuery.graphql'),
    import('@/__generated__/groupMembersTableQuery.graphql'),
    import('@/__generated__/userGroupsTabQuery.graphql'),
    import('@/__generated__/groupRowFields_group.graphql'),
    import('@/__generated__/accountRowFields_account.graphql'),
    import('@/__generated__/customerClaimFields_claim.graphql'),
    import('@/__generated__/customerOption_organization.graphql'),
  ]);
  const names = [
    'directoryUsersTableQuery',
    'useUserFiltersQuery',
    'groupsTableQuery',
    'groupMembersTableQuery',
    'userGroupsTabQuery',
    'groupRowFields_group',
    'accountRowFields_account',
    'customerClaimFields_claim',
    'customerOption_organization',
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

import { CustomerGroupsTab } from '../customers/components/details-tabs/customer-groups-tab';
import { CustomerUsersTab } from '../customers/components/details-tabs/customer-users-tab';
import { GroupMembersSection } from './components/group-detail/group-members-table';
import { UserGroupsTab } from './components/user-detail/user-groups-tab';
import { UsersView } from './components/users-list/users-view';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: true, hasPreviousPage: false };

const person = (key: string, displayName: string) => ({
  personKey: key,
  displayName,
  email: `${key}@acme.test`,
  providers: ['MICROSOFT_365'],
  status: 'ACTIVE',
  topAdmin: 'NO',
  lastSignInAt: null,
  licenses: [],
  customers: [],
  accounts: [
    {
      id: `acc-${key}`,
      signInName: `${key}@acme.test`,
      source: 'MICROSOFT_365',
      status: 'ACTIVE',
      statusReason: null,
      statusDetail: null,
      topAdmin: 'NO',
      signInData: 'READ',
      connection: { id: 'conn-1', name: 'Acme tenant', provider: 'MICROSOFT_365' },
      devices: { managed: [], unmanaged: [] },
    },
  ],
});

const group = (id: string, name: string) => ({
  id,
  name,
  provider: 'MICROSOFT_365',
  memberCount: 3,
  feed: 'PUSH',
  connection: { id: 'conn-1', name: 'Acme tenant' },
});

const member = (id: string, displayName: string) => ({
  viaGroup: null,
  member: {
    __typename: 'DirectoryAccount',
    id,
    displayName,
    email: null,
    signInName: `${id}@acme.test`,
    source: 'MICROSOFT_365',
    topAdmin: 'NO',
    customers: [],
    licenses: [],
  },
});

const page = <T,>(...nodes: T[]) => ({ totalCount: 42, edges: nodes.map(node => ({ node })), pageInfo: PAGE_INFO });

/** What the fake server answers, by operation. */
const ANSWERS: Record<string, unknown> = {
  directoryUsersTableQuery: { directoryUsers: page(person('p-1', 'Olivia Grant'), person('p-2', 'Sam Reed')) },
  useUserFiltersQuery: {
    directoryUserFilters: {
      customers: [],
      statuses: [{ value: 'ACTIVE', label: 'Active', count: 2 }],
      licenses: [],
    },
  },
  groupsTableQuery: { directoryGroups: page(group('g-1', 'Finance'), group('g-2', 'All staff')) },
  groupMembersTableQuery: {
    directoryGroup: {
      id: 'g-1',
      provider: 'MICROSOFT_365',
      members: {
        ...page(member('acc-1', 'Olivia Grant'), member('acc-2', 'Sam Reed')),
        hiddenMemberCount: 0,
        externalMemberCount: 0,
        liveDataUnavailable: false,
      },
    },
  },
  userGroupsTabQuery: { directoryAccount: { groups: page(group('g-1', 'Finance'), group('g-2', 'All staff')) } },
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
const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    element => element.getAttribute('aria-label') === label || element.textContent === label,
  );
/** Types into the search box as a person does, then waits out its debounce into the URL. */
async function typeSearch(placeholder: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
  expect(input).toBeTruthy();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(400);
}

beforeEach(() => {
  stubLayoutApis();
  answerTableFlag('off');
  openAt('/users');
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

describe('the Users page', () => {
  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    await render(<UsersView />);

    expect(container.textContent).toContain('Olivia Grant');
    expect(reads('directoryUsersTableQuery')[0]?.variables).toMatchObject({
      organizationId: null,
      search: null,
      first: 20,
      after: null,
    });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("sends the URL's cursor as after and labels the range with the URL's page", async () => {
    openAt('/users', '?cursor=c-40&page=3');
    await render(<UsersView />);

    expect(reads('directoryUsersTableQuery')[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops the cursor in the same URL write that carries a new search (one history entry)', async () => {
    openAt('/users', '?cursor=c-40&page=3');
    await render(<UsersView />);

    const pushed = await pushedWhile(() => typeSearch('Search for Users', 'vpn'));

    expect(pushed.map(params => params.toString())).toEqual(['search=vpn']);
    expect(reads('directoryUsersTableQuery').at(-1)?.variables).toMatchObject({
      search: 'vpn',
      first: 20,
      after: null,
    });
  });

  it('drops the cursor in the same URL write that ticks a funnel (one history entry)', async () => {
    openAt('/users', '?cursor=c-40&page=3');
    await render(<UsersView />);

    await click(button('Open filters'));
    const pushed = await pushedWhile(() => click(button('Pick Active')));

    expect(pushed.map(params => params.toString())).toEqual(['status=ACTIVE']);
    expect(reads('directoryUsersTableQuery').at(-1)?.variables).toMatchObject({
      filter: { statuses: ['ACTIVE'] },
      after: null,
    });
  });

  it('reads its page again when the list is marked changed (an edit, a suspend)', async () => {
    openAt('/users', '?cursor=c-40&page=3');
    await render(<UsersView />);
    const before = reads('directoryUsersTableQuery').length;

    act(() => markListChanged('directoryUsers'));
    await settle();

    expect(reads('directoryUsersTableQuery')).toHaveLength(before + 1);
    expect(reads('directoryUsersTableQuery').at(-1)?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(container.textContent).toContain('Olivia Grant');
    expect(pagerRow()).toContain('41–42 of 42');
  });
});

describe("a customer's Users tab", () => {
  const PATH = '/customers/details';
  const tab = () => <CustomerUsersTab organizationId="org-1" />;

  it("reads usersSearch and usersCursor, never the page's own search and cursor", async () => {
    openAt(PATH, '?id=org-1&tab=users&search=other&cursor=c-other&page=7&usersSearch=vpn&usersCursor=c-40&usersPage=3');
    await render(tab());

    expect(reads('directoryUsersTableQuery')[0]?.variables).toMatchObject({
      organizationId: 'org-1',
      search: 'vpn',
      first: 20,
      after: 'c-40',
    });
    expect(reads('useUserFiltersQuery')[0]?.variables).toMatchObject({ organizationId: 'org-1', search: 'vpn' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('reads the first page with no prefixed cursor in the URL', async () => {
    openAt(PATH, '?id=org-1&tab=users&search=other&cursor=c-other');
    await render(tab());

    expect(reads('directoryUsersTableQuery')[0]?.variables).toMatchObject({ search: null, first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("writes a new search to usersSearch and drops only usersCursor, leaving the page's params", async () => {
    openAt(PATH, '?id=org-1&tab=users&search=other&cursor=c-other&usersCursor=c-40&usersPage=3');
    await render(tab());

    const pushed = await pushedWhile(() => typeSearch('Search for Users', 'dns'));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({
      id: 'org-1',
      tab: 'users',
      search: 'other',
      cursor: 'c-other',
      usersSearch: 'dns',
    });
    expect(reads('directoryUsersTableQuery').at(-1)?.variables).toMatchObject({ search: 'dns', after: null });
  });
});

describe("a customer's Groups tab", () => {
  const PATH = '/customers/details';
  const tab = () => <CustomerGroupsTab organizationId="org-1" />;

  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    openAt(PATH, '?id=org-1&tab=groups');
    await render(tab());

    expect(container.textContent).toContain('Finance');
    expect(reads('groupsTableQuery')[0]?.variables).toMatchObject({
      organizationId: 'org-1',
      search: null,
      orderBy: null,
      first: 20,
      after: null,
    });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("reads groupsSearch and groupsCursor, never the page's or the Users tab's", async () => {
    openAt(
      PATH,
      '?id=org-1&tab=groups&search=other&cursor=c-other&usersCursor=c-users&usersPage=5&groupsSearch=fin&groupsCursor=c-40&groupsPage=3',
    );
    await render(tab());

    expect(reads('groupsTableQuery')[0]?.variables).toMatchObject({ search: 'fin', first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops its cursor in the same URL write that sorts by members (one history entry)', async () => {
    openAt(PATH, '?id=org-1&tab=groups&usersCursor=c-users&groupsCursor=c-40&groupsPage=3');
    await render(tab());

    const header = [...container.querySelectorAll('span')].find(span => span.textContent === 'Members');
    const pushed = await pushedWhile(() => click(header?.closest('.cursor-pointer')));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({
      id: 'org-1',
      tab: 'groups',
      usersCursor: 'c-users',
      groupsMembersSort: 'desc',
    });
    expect(reads('groupsTableQuery').at(-1)?.variables).toMatchObject({
      orderBy: { field: 'MEMBERS', direction: 'DESC' },
      after: null,
    });
  });

  it('reads its page again when the list is marked changed', async () => {
    openAt(PATH, '?id=org-1&tab=groups');
    await render(tab());
    const before = reads('groupsTableQuery').length;

    act(() => markListChanged('directoryGroups'));
    await settle();

    expect(reads('groupsTableQuery')).toHaveLength(before + 1);
    expect(container.textContent).toContain('Finance');
  });
});

describe("a group's members", () => {
  const PATH = '/customers/group';
  const section = () => <GroupMembersSection id="g-1" customerId="org-1" />;

  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    openAt(PATH, '?id=g-1&customerId=org-1');
    await render(section());

    expect(container.textContent).toContain('Olivia Grant');
    expect(reads('groupMembersTableQuery')[0]?.variables).toMatchObject({
      id: 'g-1',
      organizationId: 'org-1',
      scope: 'DIRECT',
      first: 20,
      after: null,
    });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it('reads membersScope and membersCursor, never an unprefixed cursor', async () => {
    openAt(PATH, '?id=g-1&customerId=org-1&cursor=c-other&membersScope=NESTED&membersCursor=c-40&membersPage=3');
    await render(section());

    expect(reads('groupMembersTableQuery')[0]?.variables).toMatchObject({
      scope: 'NESTED',
      first: 20,
      after: 'c-40',
    });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops its cursor in the same URL write that changes the scope (one history entry)', async () => {
    openAt(PATH, '?id=g-1&customerId=org-1&membersCursor=c-40&membersPage=3');
    await render(section());

    await click(button('Open filters'));
    const pushed = await pushedWhile(() => click(button('Pick Nested')));

    expect(pushed).toHaveLength(1);
    expect(Object.fromEntries(pushed[0] ?? [])).toEqual({ id: 'g-1', customerId: 'org-1', membersScope: 'NESTED' });
    expect(reads('groupMembersTableQuery').at(-1)?.variables).toMatchObject({ scope: 'NESTED', after: null });
  });
});

describe("a user's Groups tab", () => {
  const PATH = '/users/details';
  const tab = () => <UserGroupsTab id="acc-1" />;

  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    openAt(PATH, '?id=acc-1&tab=user-groups');
    await render(tab());

    expect(container.textContent).toContain('Finance');
    expect(reads('userGroupsTabQuery')[0]?.variables).toMatchObject({ id: 'acc-1', first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it('reads groupsCursor, never an unprefixed cursor', async () => {
    openAt(PATH, '?id=acc-1&tab=user-groups&cursor=c-other&devicesRefresh=60000&groupsCursor=c-40&groupsPage=3');
    await render(tab());

    expect(reads('userGroupsTabQuery')[0]?.variables).toMatchObject({ id: 'acc-1', first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('pages forward into groupsCursor and groupsPage with Next', async () => {
    openAt(PATH, '?id=acc-1&tab=user-groups');
    await render(tab());

    await click(button('Go to next page'));

    expect(urlParams().get('groupsCursor')).toBe('c-2');
    expect(urlParams().get('groupsPage')).toBe('2');
    expect(urlParams().has('cursor')).toBe(false);
    expect(reads('userGroupsTabQuery').at(-1)?.variables).toMatchObject({ first: 20, after: 'c-2' });
    expect(pagerRow()).toContain('21–22 of 42');
  });
});
