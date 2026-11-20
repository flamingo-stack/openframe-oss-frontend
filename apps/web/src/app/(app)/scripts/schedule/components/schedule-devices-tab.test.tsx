/**
 * A schedule's Assigned Devices tab draws the grid table only where the server serves `data-table-grid` as on, and
 * hands the same layout to every form of the list: its loading state and the loaded list never draw different tables.
 */

import type { DevicesList } from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

type ListProps = ComponentProps<typeof DevicesList>;

const env = vi.hoisted(() => ({ list: null as Record<string, unknown> | null, reads: 0 }));

// The tab's reads: one schedule with no device assigned. The table's layout does not depend on the rows.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
  useLazyLoadQuery: () => {
    env.reads += 1;
    return { scriptSchedule: { selectionMode: 'DEVICES', deviceCriteria: null } };
  },
  usePaginationFragment: () => ({
    data: { assignedDevices: { edges: [], filteredCount: 0 } },
    loadNext: () => {},
    hasNext: false,
    isLoadingNext: false,
  }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/features', async importOriginal => ({
  ...(await importOriginal<object>()),
  DevicesList: (props: Record<string, unknown>) => {
    env.list = props;
    return null;
  },
}));
// The facets read their own query; the list is drawn the same with none.
vi.mock('./schedule-device-facets', () => ({
  ScheduleDeviceFacets: ({ children }: { children: (filters: null) => React.ReactNode }) => children(null),
}));
vi.mock('./schedule-criteria-fields', () => ({ ScheduleCriteriaSummary: () => null }));

import { ScheduleDevicesTab } from './schedule-devices-tab';

const STORAGE_KEY = 'schedule-assigned-devices';

let container: HTMLDivElement;
let root: Root;

/** The list the tab drew. `held`: inside an outer loading state (the page's), so the tab draws its loading form. */
function render({ held = false }: { held?: boolean } = {}) {
  act(() =>
    root.render(
      <LoadingWhen loading={held}>
        <ScheduleDevicesTab scheduleId="sch-1" />
      </LoadingWhen>,
    ),
  );
  return env.list as unknown as ListProps;
}

const serve = (enabled: boolean) => useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled }]);

describe("a schedule's Assigned Devices tab and the table flag", () => {
  beforeEach(() => {
    env.list = null;
    env.reads = 0;
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('draws the grid table where the server serves the flag as on, under its own storage key', () => {
    serve(true);
    const list = render();
    expect(list.isLoading).toBeFalsy();
    expect(list.tableLayout).toBe('grid');
    expect(list.tableSettings).toEqual({ storageKey: STORAGE_KEY });
    // One section of the schedule's page: the page scrolls, the table takes no height of its own.
    expect(list.tableMaxHeight).toBeUndefined();
  });

  it('draws its loading form in the same layout as the loaded list', () => {
    serve(true);
    const loading = render({ held: true });
    expect(loading.isLoading).toBe(true);
    expect(loading.tableLayout).toBe('grid');
    expect(loading.tableSettings).toEqual({ storageKey: STORAGE_KEY });

    serve(false);
    const cards = render({ held: true });
    expect(cards.isLoading).toBe(true);
    expect(cards.tableLayout).toBe('cards');
    expect(cards.tableSettings).toBeUndefined();
  });

  it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
    serve(false);
    const off = render();
    expect(off.isLoading).toBeFalsy();
    expect(off.tableLayout).toBe('cards');
    expect(off.tableSettings).toBeUndefined();

    useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);
    expect(render().tableLayout).toBe('cards');
  });

  it('is its loading state while the flags are out: card rows, and no read', () => {
    const list = render();
    expect(list.isLoading).toBe(true);
    expect(list.tableLayout).toBe('cards');
    expect(list.tableSettings).toBeUndefined();
    expect(env.reads).toBe(0);
  });
});
