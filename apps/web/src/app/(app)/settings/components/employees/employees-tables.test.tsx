/**
 * The employees page's two tables follow the app's one table flag (`data-table-grid`): the grid table where it is on,
 * card rows where it is off, loading rows until it is answered. Over the real listings, tables and cells and a fake
 * network.
 *
 * What matters:
 * - flag off draws the card rows of before the grid: the users' open button outlined and hidden below `md`
 * - flag on draws the grid in BOTH of a listing's branches (its loading form and the read rows), so a refetch never
 *   swaps one layout for the other
 * - the row actions are the grid's action columns, and the card layout's column `meta` is what it was
 *
 * The users listing pages with First · Prev · Next: it is mounted under a real `useCursorPager` on the first page (the
 * URL is empty here).
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { act, type ComponentProps, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridMetaRow,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';

interface SeenColumn {
  id?: string;
  size?: number;
  meta?: { width?: string; hideAt?: string; align?: string; gridKind?: string };
}

/** The columns each table handed `useDataTable`, by the first column's cell kind: what the layouts read of them. */
const seen = vi.hoisted(() => ({ columns: [] as SeenColumn[] }));
/** The URL the pager and the auto-refresh read: an empty one, so the listing reads its first page. */
const router = vi.hoisted(() => ({ push: () => {}, replace: () => {} }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
}));
// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => {
  const actual = await importOriginal<{ useDataTable: (options: { columns: SeenColumn[] }) => unknown }>();
  return {
    ...actual,
    useDataTable: (options: { columns: SeenColumn[] }) => {
      seen.columns = options.columns;
      return actual.useDataTable(options);
    },
  };
});

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/usersListTableQuery.graphql'),
    import('@/__generated__/usersTable_user.graphql'),
    import('@/__generated__/employeeUserCell_user.graphql'),
    import('@/__generated__/employeeRolesCell_user.graphql'),
    import('@/__generated__/employeeStatusCell_user.graphql'),
    import('@/__generated__/userSummaryFields_user.graphql'),
    import('@/__generated__/employeeFilters_userFilters.graphql'),
    import('@/__generated__/invitationsListTableQuery.graphql'),
    import('@/__generated__/invitationsListTable_query.graphql'),
    import('@/__generated__/invitationsTable_invitation.graphql'),
    import('@/__generated__/invitationEmailCell_invitation.graphql'),
    import('@/__generated__/invitationRolesCell_invitation.graphql'),
    import('@/__generated__/invitationStatusCell_invitation.graphql'),
    import('@/__generated__/invitationActionsCell_invitation.graphql'),
    import('@/__generated__/invitationDialog_invitation.graphql'),
    import('@/__generated__/employeeFilters_invitationFilters.graphql'),
  ]);
  const names = [
    'usersListTableQuery',
    'usersTable_user',
    'employeeUserCell_user',
    'employeeRolesCell_user',
    'employeeStatusCell_user',
    'userSummaryFields_user',
    'employeeFilters_userFilters',
    'invitationsListTableQuery',
    'invitationsListTable_query',
    'invitationsTable_invitation',
    'invitationEmailCell_invitation',
    'invitationRolesCell_invitation',
    'invitationStatusCell_invitation',
    'invitationActionsCell_invitation',
    'invitationDialog_invitation',
    'employeeFilters_invitationFilters',
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

import { NO_EMPLOYEE_SELECTIONS } from './employee-filters';
import { USERS_PAGE_SIZE } from './employees-columns';
import { InvitationsListTable } from './invitations-list-table';
import { UsersListTable } from './users-list-table';

const USERS = {
  users: {
    filteredCount: 2,
    edges: [
      {
        cursor: 'c-1',
        node: {
          __typename: 'User',
          id: 'user-1',
          firstName: 'Maya',
          lastName: 'Chen',
          email: 'maya@acme.io',
          status: 'ACTIVE',
          image: null,
          roles: ['ADMIN'],
        },
      },
      {
        cursor: 'c-2',
        node: {
          __typename: 'User',
          id: 'user-2',
          firstName: 'Jerome',
          lastName: 'Park',
          email: 'jerome@acme.io',
          status: 'ACTIVE',
          image: null,
          roles: ['TECHNICIAN'],
        },
      },
    ],
    pageInfo: { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: false, hasPreviousPage: false },
  },
  userFilters: { statuses: [{ value: 'ACTIVE', count: 2 }], roles: [{ value: 'ADMIN', count: 1 }] },
};

const INVITATIONS = {
  invitations: {
    filteredCount: 1,
    edges: [
      {
        cursor: 'c-1',
        node: { __typename: 'Invitation', id: 'inv-1', email: 'new.hire@acme.io', status: 'PENDING', roles: ['ADMIN'] },
      },
    ],
    pageInfo: { endCursor: 'c-1', hasNextPage: false },
  },
  invitationFilters: { statuses: [{ value: 'PENDING', count: 1 }], roles: [{ value: 'ADMIN', count: 1 }] },
};

let container: HTMLDivElement;
let root: Root;

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};

async function render(element: ReactElement) {
  const environment = new Environment({
    network: Network.create(async request => ({
      data: (request.name === 'usersListTableQuery' ? USERS : INVITATIONS) as never,
    })),
    store: new Store(new RecordSource()),
  });
  act(() => root.render(<RelayEnvironmentProvider environment={environment}>{element}</RelayEnvironmentProvider>));
  await settle();
}

const LISTING_PROPS = {
  search: '',
  backendSelections: NO_EMPLOYEE_SELECTIONS,
  selections: NO_EMPLOYEE_SELECTIONS,
  onSelectionsChange: () => {},
  isPending: false,
  stickyHeaderOffset: '0px',
};

/** The users listing under the pager its page owns, on the first page. */
function PagedUsersListTable(props: Omit<ComponentProps<typeof UsersListTable>, 'pager' | 'pageVariables'>) {
  const pager = useCursorPager({ pageSize: USERS_PAGE_SIZE });
  return <UsersListTable {...props} pager={pager} pageVariables={pager.variables} />;
}

const users = () => render(<PagedUsersListTable {...LISTING_PROPS} />);
const invitations = () => render(<InvitationsListTable {...LISTING_PROPS} />);
const openButton = () => container.querySelector('button[aria-label="Open in new tab"]');
/** What the card layout reads of each column. */
const cardMeta = () => seen.columns.map(({ id, meta }) => [id, meta?.width, meta?.hideAt, meta?.align]);
/** What makes a column one of the grid's action columns. */
const gridActions = () =>
  seen.columns.filter(column => column.meta?.gridKind === 'action').map(({ id, size }) => [id, size]);

beforeEach(() => {
  stubLayoutApis();
  seen.columns = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  answerTableFlag('loading');
  window.localStorage.clear();
});

describe('UsersListTable', () => {
  it('flag off: card rows as before the grid, the open button outlined', async () => {
    answerTableFlag('off');
    await users();

    expect(container.textContent).toContain('Maya Chen');
    // No grid table: the one row above the card rows is the auto-refresh picker's, with the count beside it.
    expect(gridRoot(container)).toBeNull();
    expect(gridHeaderColumns(container)).toEqual([]);
    expect(gridMetaRow(container)?.textContent).toContain('2');
    expect(openButton()?.className).toContain('bg-ods-card');
    expect(openButton()?.className).not.toContain('border-0');
  });

  it('pages with First · Prev · Next: the range of the first page in the footer', async () => {
    answerTableFlag('off');
    await users();

    expect(container.textContent).toContain('1–2 of 2 results');
  });

  it('flag on: the grid table, filling the page, with its gear and the open action column', async () => {
    answerTableFlag('on');
    await users();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['user', 'roles', 'status']);
    expect(container.textContent).toContain('Maya Chen');
    expect(container.textContent).toContain('maya@acme.io');
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    // The grid's bare button: the action column is its frame.
    expect(openButton()?.className).toContain('border-0');
    expect(gridActions()).toEqual([['open', 56]]);
  });

  it('flag on, in a loading scope: the listing draws the grid there too, with the same height and gear', async () => {
    answerTableFlag('on');
    await render(
      <LoadingScope>
        <PagedUsersListTable {...LISTING_PROPS} />
      </LoadingScope>,
    );

    expect(gridRoot(container)).not.toBeNull();
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(container.textContent).not.toContain('Maya Chen');
  });

  it('flag not answered: loading rows, no user drawn in either layout', async () => {
    answerTableFlag('loading');
    await users();

    expect(container.textContent).not.toContain('Maya Chen');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns: the open column still hides below md", async () => {
    answerTableFlag('off');
    await users();

    expect(cardMeta()).toEqual([
      ['user', 'w-1/3 content-max-md:flex-[3] content-max-md:min-w-0', undefined, undefined],
      ['roles', 'w-1/3 content-max-md:flex-[2] content-max-md:min-w-0', undefined, undefined],
      ['status', 'w-1/3', 'md', undefined],
      ['open', 'w-12 shrink-0 flex-none', 'md', 'right'],
    ]);
  });
});

describe('InvitationsListTable', () => {
  it('flag off: card rows, nothing of the grid', async () => {
    answerTableFlag('off');
    await invitations();

    expect(container.textContent).toContain('new.hire@acme.io');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it('flag on: the grid table, filling the page, with its gear and the row menu as an action column', async () => {
    answerTableFlag('on');
    await invitations();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['user', 'roles', 'status']);
    expect(container.textContent).toContain('new.hire@acme.io');
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(gridActions()).toEqual([['actions', 56]]);
    expect(container.querySelector('button[aria-label="More actions"]')).not.toBeNull();
  });

  it('flag on, in a loading scope: the listing draws the grid there too', async () => {
    answerTableFlag('on');
    await render(
      <LoadingScope>
        <InvitationsListTable {...LISTING_PROPS} />
      </LoadingScope>,
    );

    expect(gridRoot(container)).not.toBeNull();
    expect(gridViewport(container)).not.toBeNull();
    expect(container.textContent).not.toContain('new.hire@acme.io');
  });

  it('flag not answered: loading rows, no invitation drawn in either layout', async () => {
    answerTableFlag('loading');
    await invitations();

    expect(container.textContent).not.toContain('new.hire@acme.io');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns: the row menu still hides below md", async () => {
    answerTableFlag('off');
    await invitations();

    expect(cardMeta()).toEqual([
      ['user', 'w-1/3 content-max-md:flex-[3] content-max-md:min-w-0', undefined, undefined],
      ['roles', 'w-1/3 content-max-md:flex-[2] content-max-md:min-w-0', undefined, undefined],
      ['status', 'w-1/3', 'md', undefined],
      ['actions', 'w-12 shrink-0 flex-none', 'md', 'right'],
    ]);
  });
});
