'use client';

import { PageError, PageLayout, TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Component, type ReactNode } from 'react';
import { DevicesGrid } from '@/app/(app)/devices/components/devices-grid';
import { DevicesGridFilters } from '@/app/(app)/devices/components/devices-grid-filters';
import {
  DevicesTableBody,
  getDeviceActionsColumn,
  getDeviceFilterColumns,
} from '@/app/(app)/devices/components/devices-table-columns';
// Direct import, not the `@/app/components/shared` barrel: that barrel re-exports
// `DevicesPanel`, which imports this file, and the cycle only resolves by luck.
import { DevicesFilterToolbar } from '../devices-filter-toolbar';
import {
  buildDevicePanelActions,
  DEVICE_VIEW_MODE_ITEMS,
  type DevicePanelActionsOptions,
} from './devices-panel-header';

const NO_DEVICES: never[] = [];
const NO_FILTER_GROUPS: never[] = [];
const NO_TAGS: never[] = [];
const NO_FILTERS: Record<string, string[]> = {};
const noop = () => {};
/** The loaded table's actions column, minus the actions — see `getDeviceActionsColumn`. */
const SKELETON_ACTIONS_COLUMN = getDeviceActionsColumn();

export interface DevicesPanelChrome {
  title: string;
  backButton?: { label?: string; onClick: () => void };
  className?: string;
  offsetClassName?: string;
}

export interface DevicesPanelSkeletonProps extends DevicesPanelChrome, DevicePanelActionsOptions {
  /**
   * Which half the loaded panel will render, straight from the `viewMode` URL
   * param. Table and grid are different SHAPES — a header row over full-width
   * rows versus a card grid — so a fallback that always drew the table replaced
   * itself wholesale whenever the user's saved view was the grid.
   */
  viewMode: 'table' | 'grid';
  /** Forwarded so the placeholder table has the loaded table's column set. */
  hideColumns?: string[];
  /** Forwarded so the same column headers lose their funnel as in the loaded table. */
  hideFilters?: string[];
}

/**
 * Suspense fallback for `DevicesPanel`.
 *
 * The panel's own chrome, drawn from the real components and locked — the same
 * approach the scripts pages take (`ScriptsPageSkeleton`, `SchedulePickerSkeleton`):
 * a loading state made of the REAL controls cannot drift from the thing it stands
 * in for, because it IS that thing with its data missing.
 *
 * Concretely, everything here is a prop or a URL value, none of it the device
 * query: the header buttons come from the one declaration the loaded panel also
 * reads (`devices-panel-header`), the view switch reflects `?viewMode`, and the
 * filter toolbar is the actual toolbar with empty tags. What is skeletoned is
 * only what the request answers — the rows.
 *
 * This replaced a fallback that omitted the header actions and the view switch
 * entirely and stood a plain grey bar in for the toolbar. All three moved the
 * page when the data landed: two controls appearing in the header, and a bar
 * whose height and margins were nothing like the sticky toolbar's.
 */
export function DevicesPanelSkeleton({
  title,
  backButton,
  className,
  offsetClassName,
  viewMode,
  hideColumns,
  hideFilters,
  ...actionOptions
}: DevicesPanelSkeletonProps) {
  return (
    <PageLayout
      title={title}
      backButton={backButton}
      actionsVariant="icon-buttons"
      selector={<TabSelector value={viewMode} onValueChange={noop} items={DEVICE_VIEW_MODE_ITEMS} disabled />}
      actions={buildDevicePanelActions({ ...actionOptions, disabled: true })}
      className={cn(offsetClassName, className)}
      contentClassName="flex flex-col"
    >
      <span role="status" className="sr-only">
        Loading devices…
      </span>
      {/* `inert` rather than per-control `disabled`: the toolbar's search field
          and tag chips have no disabled state of their own, and a focusable
          input that silently drops what is typed into it is worse than one that
          cannot be reached at all. */}
      <div inert>
        <DevicesFilterToolbar
          searchValue=""
          onSearchChange={noop}
          tags={NO_TAGS}
          onTagRemove={noop}
          onClearAll={noop}
          onSubmit={noop}
          onOpenFilterModal={noop}
          isFilterModalOpen={false}
          onCloseFilterModal={noop}
          filterGroups={NO_FILTER_GROUPS}
          onFilterChange={noop}
          tagFilterKeys={NO_TAGS}
          selectedTags={NO_TAGS}
          onTagsChange={noop}
          isLoading
        />
        {viewMode === 'table' ? (
          <DevicesTableBody
            devices={NO_DEVICES}
            isLoading
            emptyMessage=""
            skeletonRows={10}
            // Matches the loaded table: without it the header sticks at a
            // different offset and jumps the moment the rows arrive.
            stickyHeaderOffset="top-[96px]"
            deviceFilters={null}
            // The facets have not answered, which is NOT the same as "this list
            // has no facets". Without it `getDeviceTableColumns` reads the empty
            // options as final and hides each column's funnel, so the header
            // grew three of them the moment the query landed.
            filtersPending
            // The loaded table always carries a row-actions column, and it takes
            // real width from the others. Rendering the header without it put
            // every column at the wrong width.
            actionsColumn={SKELETON_ACTIONS_COLUMN}
            hideColumns={hideColumns}
            disableColumnFilters={hideFilters}
          />
        ) : (
          <>
            {/* Same filter row the grid loads with. `getDeviceFilterColumns`
                takes the facets, and with none it still yields every column with
                its static label — which is all this row needs to hold its
                height. `totalCount` is left off: it is the query's answer, and
                its tail is absolutely positioned, so omitting it moves nothing. */}
            <DevicesGridFilters
              filterColumns={getDeviceFilterColumns(null)}
              currentFilters={NO_FILTERS}
              onFilterChange={noop}
              isLoading
            />
            <DevicesGrid devices={NO_DEVICES} isLoading emptyMessage="" />
          </>
        )}
      </div>
    </PageLayout>
  );
}

interface BoundaryProps extends DevicesPanelChrome {
  /**
   * Changing this clears a tripped boundary. The panel feeds it the active
   * filter + search, so retrying is "narrow the list differently" — the same
   * gesture that would have refetched before, rather than a dead end that only
   * a remount escapes.
   */
  resetKey: string;
  children: ReactNode;
}

interface BoundaryState {
  message: string | null;
  resetKey: string;
}

/**
 * Keeps a failed device query inside the panel.
 *
 * The Relay hooks throw on failure instead of returning an `error` string, and
 * without a boundary that throw reaches Next's route-level `error.tsx` and
 * replaces the whole page. This preserves the previous behaviour: the page
 * chrome stays, the list area shows the error.
 */
export class DevicesPanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'Failed to load devices' };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return { message: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    console.error('[DevicesPanel] device query failed:', error);
  }

  render() {
    const { children, title, backButton, className, offsetClassName } = this.props;
    if (this.state.message === null) return children;

    return (
      <PageLayout
        title={title}
        backButton={backButton}
        actionsVariant="icon-buttons"
        className={cn(offsetClassName, className)}
        contentClassName="flex flex-col"
      >
        <PageError message={this.state.message} />
      </PageLayout>
    );
  }
}
