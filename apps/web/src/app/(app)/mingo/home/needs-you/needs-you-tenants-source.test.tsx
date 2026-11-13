/**
 * A failed tenant's row names its customers as every tenant screen does (`boundCustomerOptions`): the active ones
 * first, and one whose organization is gone as "Unknown customer" rather than not at all. With `tenant-management-v2`
 * off the row comes from main's source and operation, and while the flags read no source runs.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { createOperationDescriptor, Environment, Network, Observable, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import needsYouTenantsSourceQuery from '@/__generated__/needsYouTenantsSourceQuery.graphql';
import needsYouTenantsSourceV1Query from '@/__generated__/needsYouTenantsSourceV1Query.graphql';
import { DirectoryProvider } from '@/generated/schema-enums';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const artifacts: Record<string, unknown> = {
    needsYouTenantsSourceQuery: (await import('@/__generated__/needsYouTenantsSourceQuery.graphql')).default,
    needsYouTenantsSourceV1Query: (await import('@/__generated__/needsYouTenantsSourceV1Query.graphql')).default,
    boundCustomer_customer: (await import('@/__generated__/boundCustomer_customer.graphql')).default,
    customerOption_organization: (await import('@/__generated__/customerOption_organization.graphql')).default,
  };
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return {
    ...actual.default,
    ...actual,
    graphql: (strings: TemplateStringsArray) => {
      const name = /(?:fragment|query|mutation)\s+(\w+)/.exec(strings.join(''))?.[1] ?? '';
      return artifacts[name] ?? {};
    },
  };
});

import { NEEDS_YOU_CANDIDATES, type ReportSource } from './needs-you-rows';
import { NeedsYouTenantsSource } from './needs-you-tenants-source';

let root: Root;
let container: HTMLDivElement;

function customer(organizationId: string, organization: { name: string; status: string } | null) {
  return {
    organizationId,
    organization: organization && {
      __typename: 'Organization',
      id: `org-${organizationId}`,
      organizationId,
      image: null,
      ...organization,
    },
  };
}

function render(
  query: typeof needsYouTenantsSourceQuery | typeof needsYouTenantsSourceV1Query,
  attribution: Record<string, unknown>,
  onReport: ReportSource,
) {
  const environment = new Environment({
    network: Network.create(() => Observable.create(() => {})),
    store: new Store(new RecordSource()),
  });
  const operation = createOperationDescriptor(query, { first: NEEDS_YOU_CANDIDATES });
  environment.retain(operation);
  environment.commitPayload(operation, {
    directoryConnections: {
      edges: [
        {
          node: {
            __typename: 'DirectoryConnection',
            id: 'c-1',
            name: 'Acme',
            provider: DirectoryProvider.MICROSOFT_365,
            lastSyncAt: '2026-10-03T00:00:00Z',
            ...attribution,
          },
        },
      ],
      totalCount: 4,
    },
  });
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <NeedsYouTenantsSource onReport={onReport} />
      </RelayEnvironmentProvider>,
    );
  });
}

describe('NeedsYouTenantsSource', () => {
  beforeEach(() => {
    useFeatureFlagsStore.setState({
      flags: { 'tenant-management': true, 'tenant-management-v2': true },
      isLoaded: true,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useFeatureFlagsStore.getState().reset();
  });

  it('names the active customers first and a gone one as unknown', () => {
    const onReport = vi.fn<ReportSource>();
    render(
      needsYouTenantsSourceQuery,
      {
        customers: [
          customer('o-1', { name: 'Old Co', status: 'ARCHIVED' }),
          customer('o-2', null),
          customer('o-3', { name: 'Live Co', status: 'ACTIVE' }),
        ],
      },
      onReport,
    );
    const report = onReport.mock.lastCall?.[1];
    expect(report?.status).toBe('ready');
    const [row] = report?.status === 'ready' ? report.rows : [];
    expect(row?.detail).toBe('Microsoft 365 · Live Co, Old Co, Unknown customer');
  });

  it("reads main's operation and names its one organization while tenant-management-v2 is off", () => {
    useFeatureFlagsStore.setState({
      flags: { 'tenant-management': true, 'tenant-management-v2': false },
      isLoaded: true,
    });
    const onReport = vi.fn<ReportSource>();
    render(
      needsYouTenantsSourceV1Query,
      { organization: { __typename: 'Organization', id: 'org-o-1', name: 'Acme Co' } },
      onReport,
    );
    const report = onReport.mock.lastCall?.[1];
    expect(report?.status).toBe('ready');
    const [row] = report?.status === 'ready' ? report.rows : [];
    expect(row?.detail).toBe('Microsoft 365 · Acme Co');
    expect(row?.at).toBe(Date.UTC(2026, 9, 3));
    expect(report?.status === 'ready' && report.count).toBe(4);
  });

  it('reports nothing while the flags read', () => {
    useFeatureFlagsStore.setState({ flags: {}, isLoaded: false });
    const onReport = vi.fn<ReportSource>();
    render(needsYouTenantsSourceV1Query, { organization: null }, onReport);
    expect(onReport).not.toHaveBeenCalled();
  });
});
