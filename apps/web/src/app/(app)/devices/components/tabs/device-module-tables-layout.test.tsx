/**
 * A device's Software and Vulnerabilities tabs, with the Software module on, draw the module's own tables. Their layout
 * follows the app's table flag here as on the module's pages: card rows while it is off, the grid once it is on, as one
 * section of the device's page.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mount, SentinelObserver, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  setTableGridFlag,
  settingsGear,
} from '@/app/components/shared/table-layout-scope.fixtures';
import { firstPageProps } from '@/app/hooks/cursor-pager.fixtures';
import { DeviceSoftwareTable } from './device-software-table';
import { DeviceVulnerabilitiesTable } from './device-vulnerabilities-table';

// Dates print in the viewer's zone: one zone, so the rows read the same on every machine.
vi.hoisted(() => {
  process.env.TZ = 'UTC';
});

/** What a tab's query reads back: the test sets it before mounting the tab's table. */
const relay = vi.hoisted(() => ({ query: {} as unknown }));

// A fragment reference IS its data here: every cell reads its row's fields from the object the test hands the table.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  useFragment: (_fragment: unknown, key: unknown) => key,
  useLazyLoadQuery: () => relay.query,
  useRelayEnvironment: () => ({}),
  usePaginationFragment: (_fragment: unknown, ref: unknown) => ({
    data: ref,
    loadNext: () => {},
    hasNext: false,
    isLoadingNext: false,
  }),
}));
// A table's footer and refresh picker come from its frame's pager (`usePagedTable`): here, a first page that never moves.
vi.mock('@/app/hooks/use-paged-table', async () => {
  const fixtures = await import('@/app/hooks/cursor-pager.fixtures');
  return { usePagedTable: () => ({ pager: fixtures.FIRST_PAGE_FOOTER, refresh: undefined }) };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/devices/details',
  useSearchParams: () => new URLSearchParams(),
}));

// The lib measures text for truncation tooltips and reads viewport queries; jsdom has neither.
class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', SentinelObserver);
});
afterEach(() => {
  unmountAll();
  window.localStorage.clear();
  setTableGridFlag('loading');
});

const noop = () => {};
const connection = <T,>(rows: T[]) => ({ filteredCount: rows.length, edges: rows.map(node => ({ node })) });

function softwareTab() {
  relay.query = {
    deviceSoftware: connection([
      {
        id: 'sw-1',
        name: 'Google Chrome',
        publisher: 'Google LLC',
        currentVersion: '130.0.6723.92',
        versionStatus: 'OUTDATED',
        olderVersionsCount: 0,
        cpeMatched: true,
        vulnerabilitySummary: { cveCount: 3 },
      },
    ]),
  };
  return (
    <DeviceSoftwareTable
      {...firstPageProps(100, 'software')}
      machineId="machine-1"
      debouncedSearch=""
      isPending={false}
      emptyState={null}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

function vulnerabilitiesTab() {
  relay.query = {
    deviceVulnerabilities: connection([{ cveId: 'CVE-2026-1001', discoveredAt: '2026-11-08T12:00:00.000Z' }]),
  };
  return (
    <DeviceVulnerabilitiesTable
      {...firstPageProps(100, 'cve')}
      machineId="machine-1"
      debouncedSearch=""
      isPending={false}
      emptyState={null}
      onEmptyChange={noop}
      stickyHeaderOffset="top-[56px]"
    />
  );
}

const TABS = [
  { name: 'Software', tab: softwareTab, columns: ['name', 'currentVersion', 'cveCount'], text: 'Google Chrome' },
  { name: 'Vulnerabilities', tab: vulnerabilitiesTab, columns: ['cveId', 'discoveredAt'], text: 'CVE-2026-1001' },
] as const;

describe('A device’s module tables', () => {
  it.each(TABS)('$name keeps its card rows while the flag is off', spec => {
    setTableGridFlag('off');
    const { container } = mount(spec.tab());
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container.textContent).toContain(spec.text);
  });

  it.each(TABS)('$name draws the grid when the flag is on, as a section of the device’s page', spec => {
    setTableGridFlag('on');
    const { container } = mount(spec.tab());
    expect(gridRoot(container)).not.toBeNull();
    expect(gridColumns(container)).toEqual(spec.columns);
    expect(settingsGear(container)).not.toBeNull();
    expect(fixedViewport(container)).toBeNull();
    expect(gridBodyText(container)).toContain(spec.text);
  });

  it.each(TABS)('$name draws its loading form while the flag is read', spec => {
    setTableGridFlag('loading');
    const { container } = mount(spec.tab());
    expect(gridRoot(container)).toBeNull();
    expect(container.textContent).not.toContain(spec.text);
  });
});
