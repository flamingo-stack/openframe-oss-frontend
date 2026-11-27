/**
 * The cloud tenants list (both of its variants: the multi-customer one and main's, drawn while `tenant-management-v2`
 * is off) follows the app's one table flag: the grid table where it is on, card rows where it is off, loading rows
 * until it is answered. Over the real hosts and the lib's `TenantsTableView`, and a fake network.
 *
 * The grid fills the page and has its gear in BOTH of a host's branches (its loading form and the read rows), so a
 * refetch never swaps one layout for the other.
 */

import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstPagePager, firstPageVariables } from '@/app/hooks/cursor-pager.fixtures';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';

// The auto-refresh is off by default and waits for the subscription's answer: no guard is mounted here.
vi.mock('@/app/components/subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => false }));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const artifacts: Record<string, unknown> = {
    tenantsTableQuery: (await import('@/__generated__/tenantsTableQuery.graphql')).default,
    tenantsTableV1Query: (await import('@/__generated__/tenantsTableV1Query.graphql')).default,
    boundCustomer_customer: (await import('@/__generated__/boundCustomer_customer.graphql')).default,
    customerOption_organization: (await import('@/__generated__/customerOption_organization.graphql')).default,
  };
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

import { TenantsTableV1 } from '../v1/tenant-list/tenants-table-v1';
import { TenantsTable } from './tenants-table';

const ORGANIZATION = {
  __typename: 'Organization',
  id: 'node-acme',
  organizationId: 'org-acme',
  name: 'Acme Clinic',
  status: 'ACTIVE',
  image: null,
};

const PAGE_INFO = { hasNextPage: false, hasPreviousPage: false, startCursor: 'c-1', endCursor: 'c-1' };

const MULTI_CUSTOMER = {
  directoryConnections: {
    totalCount: 1,
    edges: [
      {
        cursor: 'c-1',
        node: {
          __typename: 'DirectoryConnection',
          id: 'conn-1',
          name: 'Acme Directory',
          provider: 'MICROSOFT_365',
          domain: 'acme.onmicrosoft.com',
          userCount: 227,
          unattributedUserCount: 0,
          lastSyncAt: '2026-10-28T09:00:00Z',
          enabled: true,
          licenseSummary: { assigned: 118, purchased: 120, unused: 2 },
          access: { state: 'WRITE_ENABLED' },
          customers: [{ organizationId: 'org-acme', organization: ORGANIZATION }],
        },
      },
    ],
    pageInfo: PAGE_INFO,
  },
};

const SINGLE_CUSTOMER = {
  directoryConnections: {
    totalCount: 1,
    edges: [
      {
        cursor: 'c-1',
        node: {
          __typename: 'DirectoryConnection',
          id: 'conn-1',
          name: 'Acme Directory',
          provider: 'MICROSOFT_365',
          domain: 'acme.onmicrosoft.com',
          userCount: 227,
          lastSyncAt: '2026-10-28T09:00:00Z',
          access: { state: 'WRITE_ENABLED' },
          organization: { id: 'node-acme', name: 'Acme Clinic', image: null },
        },
      },
    ],
    pageInfo: PAGE_INFO,
  },
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
      data: (request.name === 'tenantsTableQuery' ? MULTI_CUSTOMER : SINGLE_CUSTOMER) as never,
    })),
    store: new Store(new RecordSource()),
  });
  act(() => root.render(<RelayEnvironmentProvider environment={environment}>{element}</RelayEnvironmentProvider>));
  await settle();
}

const NO_SELECTIONS = { tenant: [], customer: [], licenses: [], access: [] };

const multiCustomer = (
  <TenantsTable
    search=""
    filter={null}
    orderBy={null}
    filters={{ options: {}, selections: NO_SELECTIONS, onChange: () => {} }}
    isPending={false}
    onEmptyChange={() => {}}
    stickyHeaderOffset="0px"
    pager={firstPagePager(20)}
    pageVariables={firstPageVariables(20)}
  />
);

const singleCustomer = (
  <TenantsTableV1
    search=""
    isPending={false}
    onEmptyChange={() => {}}
    stickyHeaderOffset="0px"
    pager={firstPagePager(20)}
    pageVariables={firstPageVariables(20)}
  />
);

beforeEach(() => {
  stubLayoutApis();
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

describe.each([
  ['TenantsTable (multi-customer)', multiCustomer, ['tenant', 'customer', 'licenses', 'access']],
  ['TenantsTableV1 (single-customer)', singleCustomer, ['tenant', 'customer', 'access']],
])('%s', (_name, table, columns) => {
  it('flag off: card rows, nothing of the grid', async () => {
    answerTableFlag('off');
    await render(table);

    expect(container.textContent).toContain('Acme Directory');
    // No grid table: the one row above the card rows holds the range, the pager and the auto-refresh picker.
    expect(gridRoot(container)).toBeNull();
    expect(gridHeaderColumns(container)).toEqual([]);
    expect(container.querySelector('[data-table-meta]')?.textContent).toContain('1–1 of 1 result');
  });

  it('flag on: the grid table, filling the page, with its gear', async () => {
    answerTableFlag('on');
    await render(table);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(columns);
    expect(container.textContent).toContain('Acme Directory');
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
  });

  it('flag on, in a loading scope: the host draws the grid there too, with the same height and gear', async () => {
    answerTableFlag('on');
    await render(<LoadingScope>{table}</LoadingScope>);

    expect(gridRoot(container)).not.toBeNull();
    expect(gridViewport(container)).not.toBeNull();
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(container.textContent).not.toContain('Acme Directory');
  });

  it('flag not answered: loading rows, no tenant drawn in either layout', async () => {
    answerTableFlag('loading');
    await render(table);

    expect(container.textContent).not.toContain('Acme Directory');
    expect(hasGridMarkup(container)).toBe(false);
  });
});
