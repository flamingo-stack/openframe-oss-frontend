/**
 * The card has room for one customer, so "+N" is the only way to the others: it must open a list of every customer
 * the tenant serves, the same set the Attribution Rules table counts (archived and deleted ones with their badge).
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { createOperationDescriptor, Environment, Network, Observable, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tenantDetailContentQuery, {
  type tenantDetailContentQuery$data,
} from '@/__generated__/tenantDetailContentQuery.graphql';
import { DirectoryAccessState, DirectoryProvider } from '@/generated/schema-enums';

// Vitest runs no Relay Babel transform, so a `graphql` tag would throw at module scope. The tags the card reads (its
// own and the `@inline` ones it reads through) resolve to their compiled artifacts, as the transform makes them; the
// rest of what it imports never reads its tags here.
vi.mock('react-relay', async importOriginal => {
  const artifacts: Record<string, unknown> = {
    tenantSummaryCard_connection: (await import('@/__generated__/tenantSummaryCard_connection.graphql')).default,
    tenantSummaryCard_identity: (await import('@/__generated__/tenantSummaryCard_identity.graphql')).default,
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

import { TenantSummaryCard } from './tenant-summary-card';

let root: Root | null = null;
let container: HTMLElement | null = null;

function customer(organizationId: string, organization: { name: string; status: string } | null) {
  return {
    organizationId,
    organization: organization && {
      __typename: 'Organization',
      id: `org-${organizationId}`,
      organizationId,
      name: organization.name,
      status: organization.status,
      image: null,
    },
  };
}

/** A store holding one answer of the details page's query, and the card's reference into it. */
function loadConnection(customers: ReturnType<typeof customer>[]) {
  const environment = new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
  const operation = createOperationDescriptor(tenantDetailContentQuery, { id: 'c-1' });
  environment.retain(operation);
  environment.commitPayload(operation, {
    directoryConnection: {
      __typename: 'DirectoryConnection',
      id: 'c-1',
      name: 'Acme',
      provider: DirectoryProvider.MICROSOFT_365,
      domain: 'acme.com',
      consentUrl: null,
      access: { state: DirectoryAccessState.READ_ONLY },
      userCount: 10,
      unattributedUserCount: 0,
      lastSyncAt: null,
      lastConsentInfo: null,
      customers,
    },
  });
  const { data } = environment.lookup(operation.fragment);
  return { environment, connection: (data as tenantDetailContentQuery$data).directoryConnection ?? null };
}

function renderCard(customers: ReturnType<typeof customer>[]): HTMLElement {
  const { environment, connection } = loadConnection(customers);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <RelayEnvironmentProvider environment={environment}>
        <TenantSummaryCard connection={connection} />
      </RelayEnvironmentProvider>,
    );
  });
  return container;
}

/** The customer cell's value (its line holds the avatar, then the value): what the card shows before anything is opened. */
function customersCell(card: HTMLElement): string | null {
  const label = [...card.querySelectorAll('p')].find(p => p.textContent === 'Customers');
  return label?.previousElementSibling?.lastElementChild?.textContent ?? null;
}

function openAllCustomers(card: HTMLElement): string[] {
  const trigger = card.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
  expect(trigger).not.toBeNull();
  act(() => {
    trigger?.focus();
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  // Each row is the avatar, the name and the badge: the name and the badge.
  return [...document.querySelectorAll('[role="menuitem"]')].map(item =>
    [...(item.firstElementChild?.children ?? [])]
      .slice(1)
      .map(part => part.textContent)
      .join(' '),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.unstubAllGlobals();
});

describe('TenantSummaryCard customers', () => {
  it('leads with an active customer and lists every customer behind "+N", inactive ones badged', () => {
    const card = renderCard([
      customer('o-1', { name: 'Harbor', status: 'ARCHIVED' }),
      customer('o-2', null),
      customer('o-3', { name: 'Acme', status: 'ACTIVE' }),
      customer('o-4', { name: 'Closed', status: 'DELETED' }),
    ]);

    expect(customersCell(card)).toBe('Acme+3 more customers');
    expect(openAllCustomers(card)).toEqual(['Acme', 'Harbor Archived', 'Unknown customer Deleted', 'Closed Deleted']);
  });

  it('shows a single customer without "+N"', () => {
    const card = renderCard([customer('o-1', { name: 'Acme', status: 'ACTIVE' })]);

    expect(customersCell(card)).toBe('Acme');
    expect(card.querySelector('button[aria-haspopup="menu"]')).toBeNull();
  });

  it('says "+1 more customer" for one more', () => {
    const card = renderCard([
      customer('o-1', { name: 'Acme', status: 'ACTIVE' }),
      customer('o-2', { name: 'Harbor', status: 'ACTIVE' }),
    ]);

    expect(customersCell(card)).toBe('Acme+1 more customer');
  });

  it('badges the lead when no customer is active', () => {
    const card = renderCard([customer('o-1', { name: 'Harbor', status: 'ARCHIVED' })]);

    expect(customersCell(card)).toBe('HarborArchived');
  });
});
