/**
 * The executions list (a script's and a schedule's Execution History, a run's executions) and the app's table flag.
 * The shell reads `data-table-grid` once and hands ONE layout to the loading table and, through its state, to the
 * loaded table, so the two never draw different tables. A list takes part by naming its storage key.
 */

import { GRID_ACTION_COLUMN_SIZE, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import type { LiveTableProps } from '@/app/components/shared/live-table';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({
  /** What the table (its loading form, or the loaded one) was drawn with. */
  loadingTable: null as Record<string, unknown> | null,
}));

vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/scripts/details',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/components/shared/live-table', async importOriginal => ({
  ...(await importOriginal<object>()),
  LiveTable: (props: Record<string, unknown>) => {
    env.loadingTable = props;
    return null;
  },
}));

import { type ExecutionsTabState, ExecutionsTabShell, ExecutionsTable, type UiExecution } from './executions-table';

const SETTINGS = { storageKey: 'script-executions' };

let container: HTMLDivElement;
let root: Root;

interface Drawn {
  /** The state the loaded list was handed (it spreads it into the table); null while the list is its loading form. */
  loaded: ExecutionsTabState | null;
  /** The loading table's props; null once the list is loaded. */
  loading: LiveTableProps<{ id: string }> | null;
}

/**
 * `held`: inside an outer loading state (the page's), so the list draws its loading form. `unnamed`: a list that
 * names no storage key (it has not moved to the grid).
 */
function render({ held = false, unnamed = false } = {}): Drawn {
  const settings = unnamed ? undefined : SETTINGS;
  const drawn: Drawn = { loaded: null, loading: null };
  env.loadingTable = null;
  act(() =>
    root.render(
      <LoadingWhen loading={held}>
        <ExecutionsTabShell tableSettings={settings}>
          {state => {
            drawn.loaded = state;
            return null;
          }}
        </ExecutionsTabShell>
      </LoadingWhen>,
    ),
  );
  drawn.loading = env.loadingTable as LiveTableProps<{ id: string }> | null;
  return drawn;
}

const DATE_FILTER: TableDateFilter = { sortDirection: 'asc', range: undefined, onApply: vi.fn() };

/** The loaded table's Execution column (the one the date sort and range belong to), in a layout. */
function loadedExecutionColumn(tableLayout: TableLayout) {
  env.loadingTable = null;
  act(() =>
    root.render(
      <ExecutionsTable
        executions={[]}
        facetOptions={{ statusOptions: [], machineOptions: [], initiatorOptions: [] }}
        tableFilters={{}}
        onFilterChange={vi.fn()}
        isPending={false}
        hasNext={false}
        isLoadingNext={false}
        onLoadMore={vi.fn()}
        search=""
        dateFilter={DATE_FILTER}
        emptyState={{ title: 'No executions' }}
        stickyHeaderOffset=""
        mobileFilterOpen={false}
        onMobileFilterClose={vi.fn()}
        tableLayout={tableLayout}
      />,
    ),
  );
  const table = (env.loadingTable as unknown as LiveTableProps<UiExecution>).table;
  return table?.getColumn('executionId')?.columnDef;
}

const serve = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);

/** jsdom has no layout: the sticky toolbar's observer has nothing to measure. */
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('the executions list and the table flag', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', IdleResizeObserver));
  afterAll(() => vi.unstubAllGlobals());

  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('hands the loaded table the grid layout and the list’s storage key where the flag is on', () => {
    serve(true);
    const { loaded, loading } = render();
    expect(loading).toBeNull();
    expect(loaded?.tableLayout).toBe('grid');
    expect(loaded?.tableSettings).toEqual(SETTINGS);
  });

  it('draws the loading table in the same layout as the loaded one', () => {
    serve(true);
    const on = render({ held: true });
    expect(on.loaded).toBeNull();
    expect(on.loading?.layout).toBe('grid');
    expect(on.loading?.settings).toEqual(SETTINGS);
    // One section of a longer page: the page scrolls, the table takes no height of its own.
    expect(on.loading?.maxHeight).toBeUndefined();

    serve(false);
    expect(render({ held: true }).loading?.layout).toBe('cards');
  });

  it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
    serve(false);
    expect(render().loaded?.tableLayout).toBe('cards');

    useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);
    expect(render().loaded?.tableLayout).toBe('cards');
  });

  it('is its loading form while the flags are out: card rows, and the list is not read', () => {
    const { loaded, loading } = render();
    expect(loaded).toBeNull();
    expect(loading?.layout).toBe('cards');
  });

  it('leaves a list that names no storage key on card rows, whatever the flag says', () => {
    serve(true);
    const named = render({ unnamed: true });
    expect(named.loaded?.tableLayout).toBe('cards');
    expect(named.loaded?.tableSettings).toBeUndefined();

    // And it does not wait for the flag: with the flags out it is read at once.
    useFeatureFlagsStore.getState().reset();
    expect(render({ unnamed: true }).loaded?.tableLayout).toBe('cards');
  });

  it('gives the grid the Execution column’s date sort and range for its own date header', () => {
    const column = loadedExecutionColumn('grid');
    // The grid names the column by its string header and draws the date menu from the column's meta.
    expect(column?.header).toBe('Execution');
    expect(column?.meta?.dateFilter).toBe(DATE_FILTER);
  });

  it('keeps the date control as the Execution header of card rows', () => {
    const column = loadedExecutionColumn('cards');
    expect(column?.header).toBeTypeOf('function');
    expect(column?.meta?.dateFilter).toBeUndefined();
  });

  it('gives every column what the grid reads: a width, a name, a one-line cell; the row actions as action columns', () => {
    serve(true);
    const columns = render({ held: true }).loading?.columns ?? [];
    const kindOf = (column: (typeof columns)[number]) => column.meta?.gridKind;
    const data = columns.filter(column => kindOf(column) !== 'action');
    const actions = columns.filter(column => kindOf(column) === 'action');

    expect(data.map(column => column.meta?.label)).toEqual(['Execution', 'Status', 'Device', 'Executed by', 'Result']);
    for (const column of data) {
      expect(column.size, column.meta?.label).toBeGreaterThanOrEqual(column.minSize ?? 0);
      expect(column.meta?.gridCell, column.meta?.label).toBeTypeOf('function');
    }
    expect(actions.map(column => column.id)).toEqual(['actions', 'open']);
    expect(columns.slice(-2)).toEqual(actions);
    for (const column of actions) expect(column.size).toBe(GRID_ACTION_COLUMN_SIZE);
  });
});
