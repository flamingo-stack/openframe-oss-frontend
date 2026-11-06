import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const artifact = (await import('@/__generated__/useTenantFiltersQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => artifact };
});

import { type TenantSelections, toTenantFilter } from './tenants-filter';
import { useTenantFilters } from './use-tenant-filters';

const FACETS = {
  providers: [{ value: 'MICROSOFT_365', label: 'Microsoft 365', count: 2 }],
  customers: [],
  accessStates: [],
  licenses: [],
};

const NONE: TenantSelections = { tenant: [], customer: [], licenses: [], access: [] };

let container: HTMLDivElement;
let root: Root;
let environment: Environment;
let fetchFn: ReturnType<typeof vi.fn>;
let latest: ReturnType<typeof useTenantFilters> | null;

function Probe({ search, selections }: { search: string; selections: TenantSelections }) {
  const filters = useTenantFilters(search, toTenantFilter(selections), selections, true);
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = filters;
  });
  return null;
}

async function render(selections: Partial<TenantSelections>, search = '') {
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Probe search={search} selections={{ ...NONE, ...selections }} />
      </RelayEnvironmentProvider>,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('useTenantFilters', () => {
  beforeEach(() => {
    latest = null;
    fetchFn = vi.fn();
    environment = new Environment({ network: Network.create(fetchFn as never), store: new Store(new RecordSource()) });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers what the server answers', async () => {
    fetchFn.mockResolvedValue({ data: { directoryConnectionFilters: FACETS } });
    await render({});
    expect(latest?.options).toEqual({
      tenant: [{ id: 'MICROSOFT_365', label: 'Microsoft 365', value: 'MICROSOFT_365', count: 2 }],
      customer: [],
      licenses: [],
      access: [],
    });
  });

  it('keeps a ticked value the facets leave out at zero on offer, in the list’s words for it', async () => {
    fetchFn.mockResolvedValue({ data: { directoryConnectionFilters: FACETS } });
    await render({
      tenant: ['MICROSOFT_365', 'GOOGLE_WORKSPACE'],
      customer: ['o-1'],
      licenses: ['HAS_UNUSED_SEATS'],
      access: ['DISCONNECTED'],
    });
    expect(latest?.options).toEqual({
      tenant: [
        { id: 'MICROSOFT_365', label: 'Microsoft 365', value: 'MICROSOFT_365', count: 2 },
        { id: 'GOOGLE_WORKSPACE', label: 'Google Workspace', value: 'GOOGLE_WORKSPACE', count: 0 },
      ],
      // No answer has named it yet, and an id has no word of the list's own.
      customer: [{ id: 'o-1', label: 'o-1', value: 'o-1', count: 0 }],
      licenses: [{ id: 'HAS_UNUSED_SEATS', label: 'Has unused seats', value: 'HAS_UNUSED_SEATS', count: 0 }],
      access: [{ id: 'DISCONNECTED', label: 'Disconnected', value: 'DISCONNECTED', count: 0 }],
    });
  });

  it('names a ticked customer a later answer leaves out as the earlier answer named it', async () => {
    fetchFn.mockResolvedValueOnce({
      data: { directoryConnectionFilters: { ...FACETS, customers: [{ value: 'o-1', label: 'Acme', count: 3 }] } },
    });
    await render({ customer: ['o-1'] });
    fetchFn.mockResolvedValueOnce({ data: { directoryConnectionFilters: FACETS } });
    await render({ customer: ['o-1'] }, 'contoso');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(latest?.options.customer).toEqual([{ id: 'o-1', label: 'Acme', value: 'o-1', count: 0 }]);
  });

  it('names an enum option in the list’s words, offered or left out, whatever the answer called it', async () => {
    const selections = { tenant: ['MICROSOFT_365'], licenses: ['HAS_UNUSED_SEATS'], access: ['DISCONNECTED'] };
    fetchFn.mockResolvedValueOnce({
      data: {
        directoryConnectionFilters: {
          providers: [{ value: 'MICROSOFT_365', label: 'Entra ID', count: 2 }],
          customers: [],
          accessStates: [{ value: 'DISCONNECTED', label: 'Offline', count: 1 }],
          licenses: [{ value: 'HAS_UNUSED_SEATS', label: 'Spare seats', count: 1 }],
        },
      },
    });
    await render(selections);
    const offered = latest?.options;
    fetchFn.mockResolvedValueOnce({
      data: { directoryConnectionFilters: { providers: [], customers: [], accessStates: [], licenses: [] } },
    });
    await render(selections, 'contoso');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(offered).toEqual({
      tenant: [{ id: 'MICROSOFT_365', label: 'Microsoft 365', value: 'MICROSOFT_365', count: 2 }],
      customer: [],
      licenses: [{ id: 'HAS_UNUSED_SEATS', label: 'Has unused seats', value: 'HAS_UNUSED_SEATS', count: 1 }],
      access: [{ id: 'DISCONNECTED', label: 'Disconnected', value: 'DISCONNECTED', count: 1 }],
    });
    expect(latest?.options).toEqual({
      tenant: [{ id: 'MICROSOFT_365', label: 'Microsoft 365', value: 'MICROSOFT_365', count: 0 }],
      customer: [],
      licenses: [{ id: 'HAS_UNUSED_SEATS', label: 'Has unused seats', value: 'HAS_UNUSED_SEATS', count: 0 }],
      access: [{ id: 'DISCONNECTED', label: 'Disconnected', value: 'DISCONNECTED', count: 0 }],
    });
  });

  it('keeps the server’s name for an option this build does not know yet', async () => {
    fetchFn.mockResolvedValue({
      data: {
        directoryConnectionFilters: {
          ...FACETS,
          accessStates: [{ value: 'PARTIAL', label: 'Partly connected', count: 1 }],
        },
      },
    });
    await render({});

    expect(latest?.options.access).toEqual([{ id: 'PARTIAL', label: 'Partly connected', value: 'PARTIAL', count: 1 }]);
  });

  it('names a ticked value no table holds by its own text, never by an inherited key', async () => {
    fetchFn.mockResolvedValue({ data: { directoryConnectionFilters: FACETS } });
    await render({ tenant: ['toString'], access: ['constructor'] });

    expect(latest?.options.tenant).toContainEqual({ id: 'toString', label: 'toString', value: 'toString', count: 0 });
    expect(latest?.options.access).toEqual([
      { id: 'constructor', label: 'constructor', value: 'constructor', count: 0 },
    ]);
  });

  it('offers a ticked value this build no longer sends, so its funnel can untick it', async () => {
    fetchFn.mockResolvedValue({ data: { directoryConnectionFilters: FACETS } });
    await render({ tenant: ['ZOHO'] });

    expect(fetchFn.mock.calls[0][1]).toMatchObject({ filter: null });
    expect(latest?.options.tenant).toEqual([
      { id: 'MICROSOFT_365', label: 'Microsoft 365', value: 'MICROSOFT_365', count: 2 },
      { id: 'ZOHO', label: 'ZOHO', value: 'ZOHO', count: 0 },
    ]);
  });
});
