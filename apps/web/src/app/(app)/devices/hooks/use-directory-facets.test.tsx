/**
 * These two facets read Pinot columns that another service applies, so they can fail while every other facet works.
 * What matters is that their failure stays theirs: no throw into the panel's error boundary, just no options.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest runs no Relay Babel transform, so the tag resolves to its compiled artifact, as the transform makes it.
vi.mock('react-relay', async importOriginal => {
  const artifact = (await import('@/__generated__/useDirectoryFacetsQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return { ...actual.default, ...actual, graphql: () => artifact };
});

import { useDirectoryFacets } from './use-directory-facets';

const OPTIONS = {
  directorySources: [{ value: 'MICROSOFT_365', count: 3 }],
  userLinks: [{ value: 'SHARED', count: 1 }],
};
const NONE = { directorySources: [], userLinks: [] };

let container: HTMLDivElement;
let root: Root;
let environment: Environment;
let fetchFn: ReturnType<typeof vi.fn>;
let latest: ReturnType<typeof useDirectoryFacets> | null;

function Probe({ enabled, statuses, userLinks }: { enabled: boolean; statuses: string[]; userLinks?: string[] }) {
  const facets = useDirectoryFacets({ statuses, userLinks }, enabled);
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = facets;
  });
  return null;
}

async function render(enabled: boolean, statuses = ['ONLINE'], userLinks?: string[]) {
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <Probe enabled={enabled} statuses={statuses} userLinks={userLinks} />
      </RelayEnvironmentProvider>,
    );
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('useDirectoryFacets', () => {
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

  it('asks nothing and offers nothing without the columns', async () => {
    await render(false);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(latest).toEqual(NONE);
  });

  it('offers what the server answers for the narrowing on screen', async () => {
    fetchFn.mockResolvedValue({ data: { deviceFilters: OPTIONS } });
    await render(true);
    expect(latest).toEqual(OPTIONS);
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ filter: { statuses: ['ONLINE'] }, list: true });
  });

  it('offers nothing when the query fails, and does not throw', async () => {
    fetchFn.mockRejectedValue(new Error('PINOT_QUERY_ERROR'));
    await render(true);
    expect(latest).toEqual(NONE);
  });

  it('asks again for the next narrowing, keeps the last options meanwhile, then takes the new ones', async () => {
    fetchFn.mockResolvedValueOnce({ data: { deviceFilters: OPTIONS } });
    await render(true);

    let answerNext: (value: unknown) => void = () => undefined;
    fetchFn.mockReturnValueOnce(new Promise(resolve => (answerNext = resolve)));
    await render(true, ['OFFLINE']);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1][1]).toMatchObject({ filter: { statuses: ['OFFLINE'] } });
    expect(latest).toEqual(OPTIONS);

    const next = { directorySources: [], userLinks: [{ value: 'PRIMARY', count: 2 }] };
    await act(async () => {
      answerNext({ data: { deviceFilters: next } });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(latest).toEqual(next);
  });

  it('keeps a value the list is narrowed by on offer when the query fails, so it can be cleared', async () => {
    fetchFn.mockRejectedValue(new Error('PINOT_QUERY_ERROR'));
    await render(true, ['ONLINE'], ['SHARED']);
    expect(latest).toEqual({ directorySources: [], userLinks: [{ value: 'SHARED', count: 0 }] });
  });

  it('does not repeat a selected value the server already offers', async () => {
    fetchFn.mockResolvedValue({ data: { deviceFilters: OPTIONS } });
    await render(true, ['ONLINE'], ['SHARED']);
    expect(latest).toEqual(OPTIONS);
  });

  it('offers a selected value the query no longer sends, so its funnel can untick it', async () => {
    fetchFn.mockResolvedValue({ data: { deviceFilters: OPTIONS } });
    await render(true, ['ONLINE'], ['RETIRED']);
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ filter: { userLinks: [] } });
    expect(latest).toEqual({ ...OPTIONS, userLinks: [...OPTIONS.userLinks, { value: 'RETIRED', count: 0 }] });
  });
});
