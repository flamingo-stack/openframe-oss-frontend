import { act, Suspense, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const artifact = (await import('@/__generated__/useUserFiltersQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => artifact };
});

import { type UserFilterOptions, useUserFilters } from './use-user-filters';
import { toFilter, type UserSelections } from './users-filter';

const FACETS = {
  customers: [{ value: 'o-1', label: 'Acme', count: 4 }],
  statuses: [],
  licenses: [],
};

const NONE: UserSelections = { customer: [], status: [], license: [] };

let container: HTMLDivElement;
let root: Root;
let environment: Environment;
let fetchFn: ReturnType<typeof vi.fn>;
let latest: UserFilterOptions | null;

function Probe({ search, selections }: { search: string; selections: UserSelections }) {
  const options = useUserFilters(undefined, search, toFilter(selections), selections);
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = options;
  });
  return null;
}

async function render(selections: Partial<UserSelections>, search = '') {
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Suspense fallback={null}>
          <Probe search={search} selections={{ ...NONE, ...selections }} />
        </Suspense>
      </RelayEnvironmentProvider>,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('useUserFilters', () => {
  beforeEach(() => {
    latest = null;
    fetchFn = vi.fn().mockResolvedValue({ data: { directoryUserFilters: FACETS } });
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
    await render({});
    expect(latest).toEqual({
      customers: [{ id: 'o-1', label: 'Acme', value: 'o-1', count: 4 }],
      statuses: [],
      licenses: [],
    });
  });

  it('keeps a ticked value the facets leave out at zero on offer, in the list’s words for it', async () => {
    await render({ customer: ['o-1'], status: ['SUSPENDED'], license: ['sku-e3', 'NO_LICENSE'] });
    expect(latest).toEqual({
      customers: [{ id: 'o-1', label: 'Acme', value: 'o-1', count: 4 }],
      statuses: [{ id: 'SUSPENDED', label: 'Suspended', value: 'SUSPENDED', count: 0 }],
      licenses: [
        // No answer has named the SKU yet, and an id has no word of the list's own.
        { id: 'sku-e3', label: 'sku-e3', value: 'sku-e3', count: 0 },
        { id: 'NO_LICENSE', label: 'No licence', value: 'NO_LICENSE', count: 0 },
      ],
    });
  });

  it('names a ticked customer or SKU a later answer leaves out as the earlier answer named it', async () => {
    fetchFn.mockResolvedValueOnce({
      data: {
        directoryUserFilters: {
          ...FACETS,
          licenses: [
            { value: 'sku-e3', label: 'Microsoft 365 E3', count: 2 },
            { value: 'NO_LICENSE', label: 'Unlicensed', count: 1 },
          ],
        },
      },
    });
    const selections = { customer: ['o-1'], license: ['sku-e3', 'NO_LICENSE'] };
    await render(selections);
    fetchFn.mockResolvedValueOnce({ data: { directoryUserFilters: { ...FACETS, customers: [] } } });
    await render(selections, 'smith');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(latest).toEqual({
      customers: [{ id: 'o-1', label: 'Acme', value: 'o-1', count: 0 }],
      statuses: [],
      licenses: [
        { id: 'sku-e3', label: 'Microsoft 365 E3', value: 'sku-e3', count: 0 },
        { id: 'NO_LICENSE', label: 'Unlicensed', value: 'NO_LICENSE', count: 0 },
      ],
    });
  });

  it('names a status in the list’s words, offered or left out, whatever the answer called it', async () => {
    fetchFn.mockResolvedValueOnce({
      data: { directoryUserFilters: { ...FACETS, statuses: [{ value: 'SUSPENDED', label: 'Blocked', count: 1 }] } },
    });
    await render({ status: ['SUSPENDED'] });
    const offered = latest?.statuses;
    await render({ status: ['SUSPENDED'] }, 'smith');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(offered).toEqual([{ id: 'SUSPENDED', label: 'Suspended', value: 'SUSPENDED', count: 1 }]);
    expect(latest?.statuses).toEqual([{ id: 'SUSPENDED', label: 'Suspended', value: 'SUSPENDED', count: 0 }]);
  });

  it('offers a ticked status this build no longer sends, so its funnel can untick it', async () => {
    await render({ status: ['ARCHIVED'] });

    expect(fetchFn.mock.calls[0][1]).toMatchObject({ filter: null });
    expect(latest?.statuses).toEqual([{ id: 'ARCHIVED', label: 'ARCHIVED', value: 'ARCHIVED', count: 0 }]);
  });
});
