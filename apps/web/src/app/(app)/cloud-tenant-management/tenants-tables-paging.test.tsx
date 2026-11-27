/**
 * The cloud tenants list (Integrations) reads one page per request, the cursor in the URL, with `tenant-management-v2`
 * on (the multi-customer list) and off (main's list). `directoryConnections` pages forward only (`first` / `after`).
 * Over the real page, the lib's `TenantsTableView`, the real pager and a fake network.
 *
 * What matters:
 * - the row above the table holds the page's range over the server's `totalCount`
 * - the URL's cursor is sent as `after`, and labels the range with the URL's page
 * - a new search drops the cursor in the same URL write
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubLayoutApis } from '@/app/hooks/use-table-layout.fixtures';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const router = vi.hoisted(() => ({ push: () => {}, replace: () => {}, back: () => {} }));

// The page's own router. The core library's hooks (the URL params, the pager, the auto-refresh) read and write the
// document's location through the library's navigation shim, so a test puts the URL there (`openAt`) and reads it back.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));
// The consent notice above the list reads its own data: not what these tests are about.
vi.mock('./components/tenant-list/consent-announcement-banner', () => ({ ConsentAnnouncementBanner: () => null }));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const load = async (modules: Promise<{ default: unknown }>[]) => (await Promise.all(modules)).map(m => m.default);
  const loaded = await load([
    import('@/__generated__/tenantsTableQuery.graphql'),
    import('@/__generated__/tenantsTableV1Query.graphql'),
    import('@/__generated__/boundCustomer_customer.graphql'),
    import('@/__generated__/customerOption_organization.graphql'),
    import('@/__generated__/useTenantFiltersQuery.graphql'),
  ]);
  const names = [
    'tenantsTableQuery',
    'tenantsTableV1Query',
    'boundCustomer_customer',
    'customerOption_organization',
    'useTenantFiltersQuery',
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

import TenantManagementPage from './page';

const PAGE_INFO = { startCursor: 'c-1', endCursor: 'c-2', hasNextPage: true, hasPreviousPage: false };

const ORGANIZATION = {
  __typename: 'Organization',
  id: 'node-acme',
  organizationId: 'org-acme',
  name: 'Acme Clinic',
  status: 'ACTIVE',
  image: null,
};

const multiCustomerTenant = (id: string, name: string) => ({
  __typename: 'DirectoryConnection',
  id,
  name,
  provider: 'MICROSOFT_365',
  domain: `${id}.onmicrosoft.com`,
  userCount: 227,
  unattributedUserCount: 0,
  lastSyncAt: '2026-10-28T09:00:00Z',
  enabled: true,
  licenseSummary: { assigned: 118, purchased: 120, unused: 2 },
  access: { state: 'WRITE_ENABLED' },
  customers: [{ organizationId: 'org-acme', organization: ORGANIZATION }],
});

const singleCustomerTenant = (id: string, name: string) => ({
  __typename: 'DirectoryConnection',
  id,
  name,
  provider: 'MICROSOFT_365',
  domain: `${id}.onmicrosoft.com`,
  userCount: 227,
  lastSyncAt: '2026-10-28T09:00:00Z',
  access: { state: 'WRITE_ENABLED' },
  organization: { id: 'node-acme', name: 'Acme Clinic', image: null },
});

/** What the fake server answers, by operation. */
const ANSWERS: Record<string, unknown> = {
  tenantsTableQuery: {
    directoryConnections: {
      totalCount: 42,
      edges: [
        { node: multiCustomerTenant('conn-1', 'Acme Directory') },
        { node: multiCustomerTenant('conn-2', 'Globex Directory') },
      ],
      pageInfo: PAGE_INFO,
    },
  },
  tenantsTableV1Query: {
    directoryConnections: {
      totalCount: 42,
      edges: [
        { node: singleCustomerTenant('conn-1', 'Acme Directory') },
        { node: singleCustomerTenant('conn-2', 'Globex Directory') },
      ],
      pageInfo: PAGE_INFO,
    },
  },
  useTenantFiltersQuery: {
    directoryConnectionFilters: { providers: [], customers: [], accessStates: [], licenses: [] },
  },
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

/** The module, its phase 2 as given, and card rows (the table flag off). */
function answerFlags(v2: boolean) {
  useFeatureFlagsStore.getState().setFlags([
    { name: 'tenant-management', enabled: true },
    { name: 'tenant-management-v2', enabled: v2 },
    { name: 'data-table-grid', enabled: false },
  ]);
}

const PATH = '/cloud-tenant-management';
/** The page's URL, as the browser shows it. */
const openAt = (search = '') => window.history.replaceState(null, '', `${PATH}${search}`);
const reads = (name: string) => requests.filter(request => request.name === name);
const pagerRow = () => container.querySelector('[data-table-meta]')?.textContent ?? '';
const urlParams = () => new URLSearchParams(window.location.search);
/** The query of every history entry the page pushed while `run` ran (the navigation shim's `pushState`). */
async function pushedWhile(run: () => Promise<void>): Promise<URLSearchParams[]> {
  const pushState = vi.spyOn(window.history, 'pushState');
  try {
    await run();
    return pushState.mock.calls.map(([, , url]) => new URL(String(url), window.location.href).searchParams);
  } finally {
    pushState.mockRestore();
  }
}
/** Types into the search box as a person does, then waits out its debounce into the URL. */
async function typeSearch(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search for Tenant"]');
  expect(input).toBeTruthy();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(700);
}

beforeEach(() => {
  stubLayoutApis();
  openAt();
  requests = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useFeatureFlagsStore.getState().reset();
});

describe.each([
  { name: 'tenant-management-v2 on: the multi-customer list', v2: true, query: 'tenantsTableQuery' },
  { name: "tenant-management-v2 off: main's list", v2: false, query: 'tenantsTableV1Query' },
])('$name', ({ v2, query }) => {
  it("reads the first page and puts its range over the server's total in the row above the table", async () => {
    answerFlags(v2);
    await render(<TenantManagementPage />);

    expect(container.textContent).toContain('Globex Directory');
    expect(reads(query)).toHaveLength(1);
    expect(reads(query)[0]?.variables).toMatchObject({ first: 20, after: null });
    expect(pagerRow()).toContain('1–2 of 42');
  });

  it("sends the URL's cursor as after and labels the range with the URL's page", async () => {
    openAt('?cursor=c-40&page=3');
    answerFlags(v2);
    await render(<TenantManagementPage />);

    expect(reads(query)[0]?.variables).toMatchObject({ first: 20, after: 'c-40' });
    expect(pagerRow()).toContain('41–42 of 42');
  });

  it('drops the cursor in the same URL write that carries a new search (one history entry)', async () => {
    openAt('?cursor=c-40&page=3');
    answerFlags(v2);
    await render(<TenantManagementPage />);

    const pushed = await pushedWhile(() => typeSearch('acme'));

    expect(pushed.map(params => params.toString())).toEqual(['search=acme']);
    expect(urlParams().toString()).toBe('search=acme');
    expect(reads(query).at(-1)?.variables).toMatchObject({ search: 'acme', first: 20, after: null });
  });
});
