/**
 * The panel's wiring of the directory gate, over the real gate and facet hooks and a fake network. What matters:
 * - Tenant Management Phase 2's panel only with `tenant-management-v2` on; off and while the flags are out, main's, which
 *   never selects or asks for anything of the directory (the off backend has none of it)
 * - the rows never depend on the directory: they are asked for at once and a failing count cannot strand them
 * - a table does not change shape under its rows on the common path, and rows are never pulled away once drawn
 * - USER and SOURCES filters in the address apply only where their columns are drawn, and can always be cleared there
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({
  // One object per address, as Next hands out: a new one per render would never let a deferred filter settle.
  searchParams: new URLSearchParams(),
  router: { push: () => undefined, replace: () => undefined, back: () => undefined },
  listFilters: [] as Record<string, unknown>[],
  /** Which list each request went to: main's (`useDevicesV1`) or Tenant Management Phase 2's (`useDevices`). */
  listsAsked: [] as ('main' | 'tm2')[],
  /** Set while the list is out: the list suspends on it, as its Relay query does. */
  listOut: null as Promise<void> | null,
  fleetFacets: {
    statuses: [{ value: 'ONLINE', label: 'Online', count: 1 }],
    deviceTypes: [],
    osTypes: [{ value: 'WINDOWS', label: 'Windows', count: 1 }],
    organizationIds: [{ value: 'o1', label: 'Org', count: 1 }],
    tagKeys: [],
    filteredCount: 1,
  },
}));

vi.mock('@/lib/runtime-config', async importOriginal => {
  const actual = await importOriginal<{ runtimeEnv: object }>();
  return { ...actual, runtimeEnv: { ...actual.runtimeEnv, appMode: () => 'saas-tenant' } };
});

vi.mock('next/navigation', () => ({
  useRouter: () => env.router,
  usePathname: () => '/devices',
  useSearchParams: () => env.searchParams,
}));

// Vitest runs no Relay Babel transform, so the tags resolve to their compiled artifacts, as the transform makes them.
vi.mock('react-relay', async importOriginal => {
  const gate = (await import('@/__generated__/useDirectoryGateQuery.graphql')).default;
  const facets = (await import('@/__generated__/useDirectoryFacetsQuery.graphql')).default;
  const actual = await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>();
  return {
    ...actual.default,
    ...actual,
    graphql: (strings: TemplateStringsArray) => {
      if (strings[0].includes('useDirectoryGateQuery')) return gate;
      return strings[0].includes('useDirectoryFacetsQuery') ? facets : {};
    },
  };
});

// The lists and the fleet facets suspend through Relay; what is under test is what the panel does around them.
vi.mock('@/app/(app)/devices/hooks/use-devices', () => ({
  useDevices: (filters: Record<string, unknown>) => fakeList('tm2', filters),
}));
vi.mock('@/app/(app)/devices/hooks/v1/use-devices-v1', () => ({
  useDevicesV1: (filters: Record<string, unknown>) => fakeList('main', filters),
}));
vi.mock('@/app/(app)/devices/hooks/use-device-filters', () => ({
  useDeviceFilters: () => env.fleetFacets,
}));
vi.mock('@/app/(app)/devices/components/device-actions-dropdown', () => ({ DeviceActionsDropdown: () => null }));
vi.mock('@/app/(app)/devices/hooks/use-remote-access-policy', () => ({ useRowRemoteAccessPolicies: () => undefined }));

import { DevicesPanel, type DevicesPanelProps } from './devices-panel';

function fakeList(list: 'main' | 'tm2', filters: Record<string, unknown>) {
  env.listsAsked.push(list);
  env.listFilters.push(filters);
  if (env.listOut) throw env.listOut;
  return {
    devices: [{ id: 'd1', machineId: 'm1', status: 'ONLINE', hostname: 'host-1' }],
    filteredCount: 1,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => undefined,
  };
}

const DIRECTORY_FACETS = {
  directorySources: [{ value: 'MICROSOFT_365', count: 1 }],
  userLinks: [{ value: 'SHARED', count: 1 }],
};

let container: HTMLDivElement;
let root: Root;
let environment: Environment;
let fetchFn: ReturnType<typeof vi.fn>;
let countAnswer: () => Promise<unknown>;
let facetsAnswer: () => Promise<unknown>;

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};
const funnels = () =>
  [...container.querySelectorAll('[aria-label^="Filter by"]')].map(node => node.getAttribute('aria-label'));
const text = () => container.textContent ?? '';
const countAsked = () => fetchFn.mock.calls.filter(call => call[0].name === 'useDirectoryGateQuery').length;
const flagsOn = () =>
  useFeatureFlagsStore.getState().setFlags([
    { name: 'tenant-management', enabled: true },
    { name: 'tenant-management-v2', enabled: true },
  ]);
const hasDirectory = (totalCount: number) => async () => ({ data: { directoryConnections: { totalCount } } });

function setAddress(search: string) {
  env.searchParams = new URLSearchParams(search);
  window.history.replaceState(null, '', `/devices${search}`);
}

function render(props: DevicesPanelProps = {}) {
  act(() => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <DevicesPanel {...props} />
      </RelayEnvironmentProvider>,
    );
  });
}

describe('DevicesPanel and the directory gate', () => {
  beforeEach(() => {
    setAddress('');
    env.listFilters = [];
    env.listsAsked = [];
    env.listOut = null;
    const Observer = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    globalThis.ResizeObserver = Observer as never;
    globalThis.IntersectionObserver = Observer as never;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as never;
    useFeatureFlagsStore.getState().reset();
    countAnswer = hasDirectory(1);
    facetsAnswer = async () => ({ data: { deviceFilters: DIRECTORY_FACETS } });
    fetchFn = vi.fn((request: { name: string }) =>
      request.name === 'useDirectoryGateQuery' ? countAnswer() : facetsAnswer(),
    );
    environment = new Environment({ network: Network.create(fetchFn as never), store: new Store(new RecordSource()) });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("draws main's panel in its loading form while the flags are out, and asks for nothing", async () => {
    render();
    await settle();
    expect(useFeatureFlagsStore.getState().isLoaded).toBe(false);
    expect(env.listsAsked).toEqual([]);
    expect(text()).not.toContain('host-1');
    expect(text()).not.toContain('USER');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('asks for the list at once, and draws it only when the count answers', async () => {
    let answerCount: (value: unknown) => void = () => undefined;
    countAnswer = () => new Promise(resolve => (answerCount = resolve));
    flagsOn();
    render();
    await settle();
    expect(env.listFilters.length).toBeGreaterThan(0);
    expect(text()).not.toContain('host-1');

    await act(async () => {
      answerCount({ data: { directoryConnections: { totalCount: 1 } } });
    });
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).toContain('USER');
    expect(text()).toContain('SOURCES');
    expect(countAsked()).toBe(1);
  });

  it('holds the rows for the count when the flags answer during a cold load and the list is still out', async () => {
    setAddress('?userLinks=SHARED');
    let answerList = () => undefined as void;
    env.listOut = new Promise<void>(resolve => {
      answerList = () => {
        env.listOut = null;
        resolve();
      };
    });
    let answerCount: (value: unknown) => void = () => undefined;
    countAnswer = () => new Promise(resolve => (answerCount = resolve));
    render();
    await settle();
    act(() => flagsOn());
    await settle();
    await act(async () => answerList());
    await settle();
    expect(text()).not.toContain('host-1');

    await act(async () => {
      answerCount({ data: { directoryConnections: { totalCount: 1 } } });
    });
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).toContain('USER');
    expect(env.listFilters.at(-1)).toMatchObject({ userLinks: ['SHARED'] });
  });

  it('draws USER and SOURCES only where a connection has synced', async () => {
    countAnswer = hasDirectory(0);
    flagsOn();
    render();
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).not.toContain('USER');
    expect(text()).not.toContain('SOURCES');
    expect(fetchFn.mock.calls.every(call => call[0].name === 'useDirectoryGateQuery')).toBe(true);
  });

  it('draws the rows with no directory columns when the count fails, and asks once', async () => {
    countAnswer = async () => {
      throw new Error('down');
    };
    flagsOn();
    render();
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).not.toContain('USER');
    expect(countAsked()).toBe(1);
  });

  it("swaps main's panel for Tenant Management Phase 2's when the flags turn on after main's rows are drawn", async () => {
    useFeatureFlagsStore.getState().setLoaded();
    let answerCount: (value: unknown) => void = () => undefined;
    countAnswer = () => new Promise(resolve => (answerCount = resolve));
    render();
    await settle();
    expect(text()).toContain('host-1');
    expect(env.listsAsked).not.toContain('tm2');

    act(() => flagsOn());
    await settle();
    expect(env.listsAsked).toContain('tm2');

    await act(async () => {
      answerCount({ data: { directoryConnections: { totalCount: 1 } } });
    });
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).toContain('USER');
  });

  it('keeps every other funnel when the directory facets fail', async () => {
    facetsAnswer = async () => {
      throw new Error('PINOT_QUERY_ERROR');
    };
    flagsOn();
    render();
    await settle();
    expect(text()).toContain('host-1');
    expect(funnels()).toEqual(expect.arrayContaining(['Filter by STATUS', 'Filter by OS', 'Filter by CUSTOMER']));
    expect(funnels()).not.toContain('Filter by USER');
  });

  it('offers USER and SOURCES funnels once the facets answer', async () => {
    flagsOn();
    render();
    await settle();
    expect(funnels()).toEqual(expect.arrayContaining(['Filter by USER', 'Filter by SOURCES', 'Filter by STATUS']));
  });

  it('keeps a funnel for a USER filter in the address, even with the facets failing', async () => {
    setAddress('?userLinks=SHARED');
    facetsAnswer = async () => {
      throw new Error('PINOT_QUERY_ERROR');
    };
    flagsOn();
    render();
    await settle();
    expect(env.listFilters.at(-1)).toMatchObject({ userLinks: ['SHARED'] });
    expect(funnels()).toContain('Filter by USER');
  });

  it('ignores USER and SOURCES filters in the address where no connection has synced', async () => {
    setAddress('?userLinks=SHARED&directorySources=MICROSOFT_365');
    countAnswer = hasDirectory(0);
    flagsOn();
    render();
    await settle();
    expect(text()).toContain('host-1');
    for (const filter of env.listFilters) {
      expect(filter).not.toHaveProperty('userLinks');
      expect(filter).not.toHaveProperty('directorySources');
    }
  });

  describe('the filter window on a desktop', () => {
    const openWindow = () =>
      act(() => {
        [...container.querySelectorAll('button')].find(button => button.textContent === 'Device Tags')?.click();
      });
    const dialog = () => document.querySelector('[role="dialog"]');

    it('keeps the header filters when Device Tags are applied', async () => {
      setAddress('?statuses=ONLINE');
      flagsOn();
      render();
      await settle();
      openWindow();
      const apply = [...(dialog()?.querySelectorAll('button') ?? [])].find(b => b.textContent === 'Apply Filters');
      expect(apply).toBeDefined();
      // The list params go through the History API (no Next router is registered with the lib here).
      const replace = vi.spyOn(window.history, 'replaceState');
      const push = vi.spyOn(window.history, 'pushState');
      await act(async () => {
        apply?.click();
      });
      await settle();
      const written = [...replace.mock.calls, ...push.mock.calls].map(call => String(call[2]));
      replace.mockRestore();
      push.mockRestore();
      // Apply ran (it closes the window); the params it sent equal the address's, so nothing need be written.
      expect(dialog()?.getAttribute('data-state')).toBe('closed');
      expect(written.every(url => url.includes('statuses=ONLINE'))).toBe(true);
      expect(window.location.search).toContain('statuses=ONLINE');
    });

    it('carries SOURCES from lg until xl, where beside the customer column its header has no funnel', async () => {
      const everyStep = window.matchMedia;
      // A 1280-1439px window: every step up to lg, not xl (1440px).
      window.matchMedia = ((query: string) => ({ ...everyStep(query), matches: !query.includes('1440px') })) as never;
      flagsOn();
      render();
      await settle();
      openWindow();
      expect(dialog()?.textContent).toContain('SOURCES');
      expect(dialog()?.textContent).not.toContain('STATUS');
    });

    it('leaves SOURCES to the header from xl, where its funnel is back', async () => {
      flagsOn();
      render();
      await settle();
      openWindow();
      expect(dialog()).not.toBeNull();
      expect(dialog()?.textContent).not.toContain('SOURCES');
    });

    it("leaves SOURCES to the header on one customer's list", async () => {
      flagsOn();
      render({ hideColumns: ['organization'] });
      await settle();
      openWindow();
      expect(dialog()).not.toBeNull();
      expect(dialog()?.textContent).not.toContain('SOURCES');
    });

    it('leaves SOURCES to the grid, which draws a dropdown of its own', async () => {
      setAddress('?viewMode=grid');
      flagsOn();
      render();
      await settle();
      openWindow();
      expect(dialog()).not.toBeNull();
      expect(dialog()?.textContent).not.toContain('SOURCES');
    });
  });

  describe("with tenant-management-v2 off: main's panel", () => {
    const flagsOff = () =>
      useFeatureFlagsStore.getState().setFlags([
        { name: 'tenant-management', enabled: true },
        { name: 'tenant-management-v2', enabled: false },
      ]);

    it("draws main's list with no USER or SOURCES, and asks nothing of the directory", async () => {
      flagsOff();
      render();
      await settle();
      expect(text()).toContain('host-1');
      expect(env.listsAsked.length).toBeGreaterThan(0);
      expect(env.listsAsked.every(list => list === 'main')).toBe(true);
      expect(text()).not.toContain('USER');
      expect(text()).not.toContain('SOURCES');
      expect(funnels()).toEqual(expect.arrayContaining(['Filter by STATUS', 'Filter by OS', 'Filter by CUSTOMER']));
      expect(funnels()).not.toContain('Filter by USER');
      expect(funnels()).not.toContain('Filter by SOURCES');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('ignores USER and SOURCES filters in the address', async () => {
      setAddress('?userLinks=SHARED&directorySources=MICROSOFT_365');
      flagsOff();
      render();
      await settle();
      expect(text()).toContain('host-1');
      for (const filter of env.listFilters) {
        expect(filter).not.toHaveProperty('userLinks');
        expect(filter).not.toHaveProperty('directorySources');
      }
    });

    it('is the panel when the flags fail, as they then read off', async () => {
      useFeatureFlagsStore.getState().setLoaded();
      render();
      await settle();
      expect(text()).toContain('host-1');
      expect(env.listsAsked.every(list => list === 'main')).toBe(true);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  it('holds nothing and ignores those filters on the archive, whatever the tenant has', async () => {
    setAddress('?userLinks=SHARED');
    countAnswer = () => new Promise(() => undefined);
    flagsOn();
    render({ withoutDirectory: true });
    await settle();
    expect(text()).toContain('host-1');
    expect(text()).not.toContain('USER');
    expect(env.listFilters.at(-1)).not.toHaveProperty('userLinks');
  });
});
