/**
 * `userLinks` and `directorySources` can sit in a shared or old link. Where the list draws no USER or SOURCES column
 * there is no funnel to show or clear them, so they must narrow nothing rather than hide rows with no explanation.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const url = vi.hoisted(() => ({
  params: {
    search: '',
    statuses: [] as string[],
    osTypes: [] as string[],
    organizationIds: [] as string[],
    userLinks: ['SHARED'],
    directorySources: ['MICROSOFT_365'],
    tags: [] as string[],
    viewMode: 'table',
  },
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  DEFAULT_DEVICES_LIST_STATUSES: ['ONLINE', 'OFFLINE'],
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useApiParams: () => ({ params: url.params, setParam: vi.fn(), setParams: vi.fn() }),
}));
vi.mock('@/app/hooks/use-search-param', () => ({
  useSearchParam: () => ({ search: '', setSearch: vi.fn(), debouncedSearch: '' }),
}));

import { useDevicesUrlParams } from './use-devices-url-params';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useDevicesUrlParams> | null;

function Probe({ directoryColumns }: { directoryColumns?: boolean }) {
  const result = useDevicesUrlParams({ directoryColumns });
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = result;
  });
  return null;
}

function render(directoryColumns?: boolean) {
  act(() => {
    root.render(<Probe directoryColumns={directoryColumns} />);
  });
  return latest as ReturnType<typeof useDevicesUrlParams>;
}

describe('useDevicesUrlParams, directory filters in the address', () => {
  beforeEach(() => {
    latest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('narrows by them where the list draws the columns', () => {
    const { filters, params, tableFilters } = render(true);
    expect(filters).toMatchObject({ userLinks: ['SHARED'], directorySources: ['MICROSOFT_365'] });
    expect(params).toMatchObject({ userLinks: ['SHARED'], directorySources: ['MICROSOFT_365'] });
    expect(tableFilters).toMatchObject({ user: ['SHARED'], sources: ['MICROSOFT_365'] });
  });

  it.each([false, undefined])('ignores them everywhere with directoryColumns %s', directoryColumns => {
    const { filters, params, tableFilters } = render(directoryColumns);
    expect(filters).not.toHaveProperty('userLinks');
    expect(filters).not.toHaveProperty('directorySources');
    // The panel reads these for "is a filter active" and for its checked funnels.
    expect(params).toMatchObject({ userLinks: [], directorySources: [] });
    expect(tableFilters).toMatchObject({ user: [], sources: [] });
  });
});
