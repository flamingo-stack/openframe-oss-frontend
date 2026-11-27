/**
 * The Scripts lists (scripts, schedules, a schedule's runs) and the app's table flag. Each page reads
 * `data-table-grid` once and hands the layout to its list; these draw every list in its loading form, which gets the
 * same layout props as the loaded table (one helper builds both), and check what the list's columns state for the
 * grid. The executions list has its own test beside its shell; the loaded lists' paging is in
 * `scripts-tables-paging.test.tsx`.
 */

import { GRID_ACTION_COLUMN_SIZE, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveTableProps } from '@/app/components/shared/live-table';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({ table: null as Record<string, unknown> | null }));

vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/scripts',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/components/shared/live-table', async importOriginal => ({
  ...(await importOriginal<object>()),
  LiveTable: (props: Record<string, unknown>) => {
    env.table = props;
    return null;
  },
}));
// The pages' toolbars and header actions: not what these tests are about, and they read their own data.
vi.mock('./script/components/scripts-tag-filter', () => ({ ScriptsTagFilter: () => null }));
vi.mock('@/app/(app)/mingo/hooks/use-generate-with-ai-action', () => ({ useGenerateWithAiAction: () => undefined }));

import { ScheduleRunsTab } from './schedule/components/schedule-runs-tab';
import { ScriptSchedulesTable } from './schedule/components/script-schedules-table';
import { ScriptsTable } from './script/components/scripts-table';

type Table = LiveTableProps<{ id: string }>;

interface ListCase {
  name: string;
  list: () => ReactElement;
  storageKey: string;
  /** The grid table's height: the page's scroll area on a list page, none on a tab of a longer page. */
  maxHeight: 'fill' | undefined;
  /** The data columns' names in the settings menu, in order. */
  labels: string[];
}

const LISTS: ListCase[] = [
  {
    name: 'the scripts list',
    list: () => <ScriptsTable />,
    storageKey: 'scripts',
    maxHeight: 'fill',
    labels: ['Name', 'Shell type', 'OS', 'Added by'],
  },
  {
    name: 'the archived scripts list',
    list: () => <ScriptsTable archived />,
    storageKey: 'scripts',
    maxHeight: 'fill',
    labels: ['Name', 'Shell type', 'OS', 'Added by'],
  },
  {
    name: 'the schedules list',
    list: () => <ScriptSchedulesTable />,
    storageKey: 'script-schedules',
    maxHeight: 'fill',
    labels: ['Script', 'OS', 'Date and time', 'Repeat', 'Devices'],
  },
  {
    name: "a schedule's runs",
    list: () => <ScheduleRunsTab scheduleId="sch-1" />,
    storageKey: 'schedule-runs',
    maxHeight: undefined,
    labels: ['Execution', 'Status', 'Devices', 'Executed by'],
  },
];

/** jsdom has no layout: the sticky toolbar's observer has nothing to measure. */
class IdleResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

/** The list's table. `held`: inside an outer loading state (the page's), so the list draws its loading form. */
function render(list: ReactElement, { held = false } = {}): Table {
  // Mounted anew each time: a memoised tab does not draw again for the same props and the same flag answer.
  act(() => root.render(null));
  env.table = null;
  act(() => root.render(<LoadingWhen loading={held}>{list}</LoadingWhen>));
  return env.table as unknown as Table;
}

const serve = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);

describe('the Scripts lists and the table flag', () => {
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

  describe.each(LISTS)('$name', ({ list, storageKey, maxHeight, labels }) => {
    it('draws the grid table where the server serves the flag as on, under its own storage key', () => {
      serve(true);
      const table = render(list(), { held: true });
      expect(table.layout).toBe('grid');
      expect(table.settings).toEqual({ storageKey });
      expect(table.maxHeight).toBe(maxHeight);
    });

    it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
      serve(false);
      expect(render(list(), { held: true }).layout).toBe('cards');

      useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);
      expect(render(list(), { held: true }).layout).toBe('cards');
    });

    it('is its loading form while the flags are out, in card rows', () => {
      // Not held by the page: the unanswered flag alone keeps the list in its loading form (no read runs).
      const table = render(list());
      expect(table.columns).toBeDefined();
      expect(table.layout).toBe('cards');
    });

    it('gives every column what the grid reads: a width and a name; the row actions as action columns', () => {
      serve(true);
      const columns = render(list(), { held: true }).columns ?? [];
      const data = columns.filter(column => column.meta?.gridKind !== 'action');
      const actions = columns.filter(column => column.meta?.gridKind === 'action');

      expect(data.map(column => column.meta?.label)).toEqual(labels);
      for (const column of data) {
        expect(column.size, column.meta?.label).toBeGreaterThanOrEqual(column.minSize ?? 120);
      }
      expect(actions.map(column => column.id)).toEqual(['actions', 'open']);
      expect(columns.slice(-2)).toEqual(actions);
      for (const column of actions) expect(column.size).toBe(GRID_ACTION_COLUMN_SIZE);
    });
  });

  // The list pages (scripts, schedules and their archives) page with First · Prev · Next: their loading form draws the
  // pager row too, waiting, so the loaded table does not push the rows down when it lands.
  describe.each(LISTS.filter(({ list }) => list().type !== ScheduleRunsTab))('$name', ({ list }) => {
    it('draws the pager in its loading form, waiting for the first page', () => {
      serve(false);
      const table = render(list(), { held: true });
      expect(table.pager).toBeNull();
      expect(table.footer).toBeUndefined();
    });
  });
});
