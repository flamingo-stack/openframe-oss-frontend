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
    connectivity: [] as string[],
    osTypes: [] as string[],
    organizationIds: [] as string[],
    userLinks: ['SHARED'],
    directorySources: ['MICROSOFT_365'],
    tags: [] as string[],
    viewMode: 'table',
  },
  statusDisplay: 'lifecycle' as 'lifecycle' | 'legacy',
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/features', () => ({
  DEFAULT_DEVICES_LIST_STATUSES: ['MANAGED', 'PENDING_DELETION'],
  DEVICE_CONNECTIVITY_FILTER_SECTION: 'connectivity',
  splitStatusFilterValue: (values: string[] | undefined) => ({
    statuses: (values ?? []).filter(v => !v.startsWith('connectivity:')),
    connectivity: (values ?? []).filter(v => v.startsWith('connectivity:')).map(v => v.slice('connectivity:'.length)),
  }),
  useDeviceStatusDisplay: () => url.statusDisplay,
  deviceStatusFilterGroups: (statuses: string[], connectivity: string[], display: 'lifecycle' | 'legacy') =>
    display === 'legacy'
      ? { status: [...statuses, ...connectivity.map(v => `connectivity:${v}`)] }
      : { status: statuses, connectivity },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useApiParams: () => ({ params: url.params, setParam: vi.fn(), setParams: vi.fn() }),
}));
vi.mock('@/app/hooks/use-search-param', () => ({
  useSearchParam: () => ({ search: '', setSearch: vi.fn(), debouncedSearch: '' }),
}));

import { translateLegacyDeviceStatuses, useDevicesUrlParams } from './use-devices-url-params';

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

describe('useDevicesUrlParams, lifecycle and connectivity', () => {
  beforeEach(() => {
    latest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    url.params.statuses = [];
    url.params.connectivity = [];
    url.statusDisplay = 'lifecycle';
  });

  it('queries the default lifecycle and narrows by connectivity from the address', () => {
    url.params.connectivity = ['ONLINE'];
    const { filters, tableFilters } = render();
    expect(filters).toMatchObject({ statuses: ['MANAGED', 'PENDING_DELETION'], connectivity: ['ONLINE'] });
    // The default statuses are a query-side fallback: nothing reads as checked.
    expect(tableFilters).toMatchObject({ status: [], connectivity: ['ONLINE'] });
  });

  it('reads an old ?statuses=ONLINE link as Managed and online', () => {
    url.params.statuses = ['ONLINE'];
    const { filters, tableFilters } = render();
    expect(filters).toMatchObject({ statuses: ['MANAGED'], connectivity: ['ONLINE'] });
    expect(tableFilters).toMatchObject({ status: ['MANAGED'], connectivity: ['ONLINE'] });
  });

  // `device-managed-status` off: Online / Offline are STATUS options again, so their picks ride in STATUS.
  it('hands the filters Online / Offline inside STATUS in the legacy display, and queries the same', () => {
    url.statusDisplay = 'legacy';
    url.params.connectivity = ['ONLINE'];
    const { filters, tableFilters } = render();
    expect(filters).toMatchObject({ statuses: ['MANAGED', 'PENDING_DELETION'], connectivity: ['ONLINE'] });
    expect(tableFilters).toMatchObject({ status: ['connectivity:ONLINE'] });
    expect(tableFilters).not.toHaveProperty('connectivity');
  });
});

describe('translateLegacyDeviceStatuses', () => {
  it.each([
    [['OFFLINE'], [], ['MANAGED'], ['OFFLINE']],
    [['ONLINE', 'OFFLINE'], [], ['MANAGED'], []],
    [['ONLINE', 'PENDING'], [], ['PENDING', 'MANAGED'], ['ONLINE']],
    [['ONLINE'], ['OFFLINE'], ['MANAGED'], ['OFFLINE']],
    [['MANAGED'], ['ONLINE'], ['MANAGED'], ['ONLINE']],
  ])('%j + connectivity %j → %j / %j', (statuses, connectivity, expectedStatuses, expectedConnectivity) => {
    expect(translateLegacyDeviceStatuses(statuses, connectivity)).toEqual({
      statuses: expectedStatuses,
      connectivity: expectedConnectivity,
    });
  });
});
