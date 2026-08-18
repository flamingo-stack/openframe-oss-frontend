'use client';

import {
  Alert,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type OnChangeFn,
  type PageActionButton,
  PageError,
  PageLayout,
  TabSelector,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { AlertTriangle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo } from 'react';
import { DevicesGrid } from '@/app/(app)/devices/components/devices-grid';
import { DevicesGridFilters } from '@/app/(app)/devices/components/devices-grid-filters';
import {
  DevicesTableBody,
  getDeviceActionsColumn,
  getDeviceFilterColumns,
  getDeviceTableRowActions,
} from '@/app/(app)/devices/components/devices-table-columns';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import { useDevices } from '@/app/(app)/devices/hooks/use-devices';
import { useDevicesUrlParams } from '@/app/(app)/devices/hooks/use-devices-url-params';
import { useGridInfiniteScroll } from '@/app/(app)/devices/hooks/use-grid-infinite-scroll';
import { useTagFilterModal } from '@/app/(app)/devices/hooks/use-tag-filter-modal';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { bumpDeviceEpoch } from '@/app/(app)/devices/utils/device-refresh';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { ContentErrorBoundary } from '../content-error-boundary';
import { DevicesFilterToolbar } from '../devices-filter-toolbar';
import { EMBEDDED_PAGE_OFFSET } from '../embedded-page';
import { DevicesPanelSkeleton } from './devices-panel-boundaries';
import { buildDevicePanelActions, DEVICE_VIEW_MODE_ITEMS } from './devices-panel-header';

export interface DevicesPanelProps {
  /** Page title shown in the PageLayout header. */
  title?: string;
  /** Back button rendered above the title (e.g. on the archive page). */
  backButton?: { label?: string; onClick: () => void };
  /** Destination of the "Add Device" button. */
  addDeviceHref?: string;
  /** When false, drops the "Add Device" header button (e.g. on the archive page). */
  showAddDevice?: boolean;
  /** When set, shows an "Archive" header button linking to the archived-devices page. */
  archiveHref?: string;
  /** Filters merged on top of URL-driven filters (e.g. lock to a single organization). */
  lockedFilters?: Partial<DeviceFilterInput>;
  /** Column ids to drop from the table (e.g. 'organization' when scoped to one org). */
  hideColumns?: string[];
  /**
   * Filter keys to drop from the filter UI — the FilterModal, the grid filter
   * row, and the table column-header filter (the column itself stays visible),
   * e.g. 'organization' when scoped to one org, or 'status' on the archive page.
   */
  hideFilters?: string[];
  /** Message shown when the list is empty (with search/filters active or no `emptyState` given). */
  emptyMessage?: string;
  /**
   * Default statuses applied when the user hasn't picked any. Pass `[]` to disable
   * the default and return devices of all statuses (e.g. when scoped to one customer).
   */
  defaultStatuses?: string[];
  /**
   * Overrides the PageLayout wrapper className. Pass an empty string to disable
   * the default side/bottom padding (e.g. when embedded inside a tab whose parent
   * already provides padding).
   */
  className?: string;
  /**
   * Render inside a tab (e.g. customer details) — drops the standalone top padding
   * via `EMBEDDED_PAGE_OFFSET` so the header sits flush under the tab bar.
   */
  embedded?: boolean;
  /**
   * Empty state rendered instead of the toolbar + list when there are
   * no devices and no active search/filters. Pass from the standalone Devices
   * page; omit in embedded contexts to keep the inline "no results" message.
   */
  emptyState?: ReactNode;
  /**
   * When true, the tenant has no organizations (customers) to attach a device to.
   * Surfaces an "Add Customer" action and shows a banner prompting the user to add
   * a customer first. Pass from the standalone Devices page; omit in embedded
   * contexts where an organization always exists.
   */
  noOrganizations?: boolean;
  /**
   * When true, the organization check is still in flight. "Add Device" stays
   * disabled as a safety measure, but the "no customer" banner is suppressed so
   * it doesn't flash before the answer is known.
   */
  isCheckingOrganizations?: boolean;
}

function DevicesPanelContent({
  title = 'Devices',
  backButton,
  addDeviceHref = routes.devices.new(),
  showAddDevice = true,
  archiveHref,
  lockedFilters,
  hideColumns,
  hideFilters,
  emptyMessage = 'No devices found. Try adjusting your search or filters.',
  defaultStatuses,
  className = '',
  embedded = false,
  emptyState,
  noOrganizations = false,
  isCheckingOrganizations = false,
}: DevicesPanelProps) {
  const router = useRouter();

  const {
    params,
    setParam,
    setParams,
    localSearch,
    setLocalSearch,
    debouncedSearch,
    filters: urlFilters,
    tableFilters,
    tagOptions,
    handleFilterChange,
    handleTagRemove,
    handleClearAll,
    handleTagSubmit,
  } = useDevicesUrlParams({ defaultStatuses });

  const filters = useMemo<DeviceFilterInput>(() => ({ ...urlFilters, ...lockedFilters }), [urlFilters, lockedFilters]);

  // The device queries suspend, and re-suspend whenever their variables change.
  // Deferring the variables makes a filter or search change a TRANSITION: React
  // keeps the current rows on screen while the next set loads, instead of
  // dropping the whole panel to its skeleton mid-interaction. The controls
  // themselves still read the live `params`, so a checkbox ticks immediately.
  const { deferredFilters, deferredSearch, isPending: isNarrowing } = useDeferredQuery(filters, debouncedSearch);

  const { devices, isFetchingNextPage, hasNextPage, fetchNextPage, filteredCount } = useDevices(
    deferredFilters,
    deferredSearch,
  );

  const deviceFilters = useDeviceFilters(deferredFilters);

  const hasActiveDeviceFilters =
    params.statuses.length > 0 ||
    params.osTypes.length > 0 ||
    params.organizationIds.length > 0 ||
    params.tags.length > 0;

  // Pristine, genuinely-empty view (no search, no filters, no devices): show the
  // empty state instead of the toolbar + list, when one is provided.
  // `!isNarrowing` matters: the rows are DEFERRED while the params are live, so
  // during a transition `devices` still answers the PREVIOUS query. Without it,
  // clearing a filter that matched nothing flashes the marketing empty state —
  // pulling the toolbar out from under the user — before the rows arrive.
  const showEmptyState =
    !!emptyState && !isNarrowing && !debouncedSearch && !hasActiveDeviceFilters && devices.length === 0;

  const filterColumns = useMemo(() => {
    const hidden = new Set(hideFilters ?? []);
    return getDeviceFilterColumns(deviceFilters).filter(c => !hidden.has(c.key));
  }, [deviceFilters, hideFilters]);
  // Post-action list refresh is handled centrally: useDeviceActions invalidates
  // the device query roots, so no per-row refetch callback is needed.
  const renderRowActions = useMemo(() => getDeviceTableRowActions(), []);

  // The status column reflects only the user's explicit selection — the default
  // statuses are a query-side fallback and must not render as checked filters.
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(params.statuses.length > 0 ? [{ id: 'status', value: params.statuses }] : []),
      ...(params.osTypes.length > 0 ? [{ id: 'os', value: params.osTypes }] : []),
      ...(params.organizationIds.length > 0 ? [{ id: 'organization', value: params.organizationIds }] : []),
    ],
    [params.statuses, params.osTypes, params.organizationIds],
  );

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      handleFilterChange(Object.fromEntries(next.map(f => [f.id, f.value as string[]])));
    },
    [columnFilters, handleFilterChange],
  );

  const actionsColumn = useMemo<ColumnDef<Device>>(() => getDeviceActionsColumn(renderRowActions), [renderRowActions]);

  const {
    isOpen: filterModalOpen,
    open: openFilterModal,
    close: closeFilterModal,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange: handleModalFilterChange,
    handleTagsChange: handleModalTagsChange,
    selectedTags,
  } = useTagFilterModal({
    tags: params.tags,
    deviceFilters,
    columns: filterColumns,
    setParams,
  });

  // Grid layout is desktop-only — force-collapse to table on mobile so the
  // user always gets a usable list at narrow widths.
  //
  // `=== false`, NOT `!isMdUp`: the hook answers `undefined` until an effect has run,
  // so `!isMdUp` was true on the first pass at every width — on a desktop load with
  // `viewMode=grid` persisted, this wrote `viewMode=table` into the URL and silently
  // destroyed the user's grid preference on every visit.
  useEffect(() => {
    if (isMdUp === false && params.viewMode === 'grid') {
      setParam('viewMode', 'table');
    }
  }, [isMdUp, params.viewMode, setParam]);

  // Built from the declaration the Suspense fallback also reads, so the loading
  // header and the loaded one can't drift apart (see `devices-panel-header`).
  const actions = useMemo<PageActionButton[]>(
    () =>
      buildDevicePanelActions({
        archiveHref,
        showAddDevice,
        noOrganizations,
        isCheckingOrganizations,
        accent: showEmptyState && !noOrganizations,
        onAddDevice: () => router.push(addDeviceHref),
      }),
    [archiveHref, showAddDevice, showEmptyState, noOrganizations, isCheckingOrganizations, router, addDeviceHref],
  );

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);

  const gridSentinelRef = useGridInfiniteScroll({
    enabled: params.viewMode === 'grid',
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <>
      <PageLayout
        title={title}
        backButton={backButton}
        actionsVariant="icon-buttons"
        className={cn(embedded && EMBEDDED_PAGE_OFFSET, className)}
        selector={
          <TabSelector
            value={params.viewMode}
            onValueChange={v => setParam('viewMode', v as 'table' | 'grid')}
            items={DEVICE_VIEW_MODE_ITEMS}
          />
        }
        actions={actions}
        contentClassName="flex flex-col"
      >
        {noOrganizations && (
          // Core Alert restyled to the ODS warning tokens. The icon is wrapped in a
          // span so Alert's `[&>svg]` absolute-positioning rules don't apply.
          <Alert className="flex items-start gap-[var(--spacing-system-m)] mb-[var(--spacing-system-l)] rounded-[6px] border-0 bg-ods-warning-secondary text-ods-warning">
            <span className="shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </span>
            <p className="text-h3">Add a customer to connect a new device</p>
          </Alert>
        )}
        {showEmptyState ? (
          emptyState
        ) : (
          // Dimmed, not skeletoned, while a filter/search change resolves: the
          // rows on screen are the previous answer and stay readable until the
          // next one arrives (see the deferred variables above).
          <div className={cn(isNarrowing && 'opacity-60 transition-opacity')}>
            <DevicesFilterToolbar
              searchValue={localSearch}
              onSearchChange={setLocalSearch}
              tags={tagOptions}
              onTagRemove={handleTagRemove}
              onClearAll={handleClearAll}
              onSubmit={handleTagSubmit}
              onOpenFilterModal={openFilterModal}
              isFilterModalOpen={filterModalOpen}
              onCloseFilterModal={closeFilterModal}
              filterGroups={filterGroups}
              onFilterChange={handleModalFilterChange}
              currentFilters={isMdUp === false ? tableFilters : undefined}
              tagFilterKeys={tagFilterKeys}
              selectedTags={selectedTags}
              onTagsChange={handleModalTagsChange}
              isLoading={false}
            />
            {params.viewMode === 'table' ? (
              <DevicesTableBody
                devices={devices}
                isLoading={false}
                emptyMessage={emptyMessage}
                skeletonRows={10}
                stickyHeaderOffset="top-[96px]"
                deviceFilters={deviceFilters}
                // No `filtersPending`: the facet query suspends alongside the
                // list, so by the time this renders the facets are already in
                // hand. The "isLoading false before the request started" race it
                // guards against is a react-query behaviour, not a Relay one.
                columnFilters={columnFilters}
                onColumnFiltersChange={onColumnFiltersChange}
                actionsColumn={actionsColumn}
                hideColumns={hideColumns}
                disableColumnFilters={hideFilters}
                totalCount={filteredCount}
                footerSlot={
                  <DataTable.InfiniteFooter
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    onLoadMore={handleLoadMore}
                    skeletonRows={2}
                  />
                }
              />
            ) : (
              <>
                <DevicesGridFilters
                  filterColumns={filterColumns}
                  currentFilters={tableFilters}
                  onFilterChange={handleFilterChange}
                  totalCount={filteredCount}
                />
                <DevicesGrid
                  devices={devices}
                  isLoading={false}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  sentinelRef={gridSentinelRef}
                  emptyMessage={emptyMessage}
                />
              </>
            )}
          </div>
        )}
      </PageLayout>
    </>
  );
}

/**
 * The device list, in every place it appears: the Devices page, the archive
 * page and the customer devices tab.
 *
 * The content suspends (its list and facet queries are Relay), so it is wrapped
 * here once rather than at each of the three call sites — they keep passing
 * plain props and stay unaware of the boundary. The error boundary sits OUTSIDE
 * the Suspense one so a failed query renders the panel's own error state instead
 * of escaping to the route-level `error.tsx`.
 */
export function DevicesPanel(props: DevicesPanelProps) {
  // The list's whole query surface lives in the URL, so the query string is the
  // honest "the user asked for something different" signal — it clears a tripped
  // error boundary without the panel having to reach inside the content that threw.
  const searchParams = useSearchParams();
  const resetKey = searchParams.toString();

  const chrome = {
    title: props.title ?? 'Devices',
    backButton: props.backButton,
    className: props.className,
    offsetClassName: props.embedded ? EMBEDDED_PAGE_OFFSET : undefined,
  };

  // Read straight off the URL rather than through `useDevicesUrlParams`: this
  // component sits OUTSIDE the boundary, and the fallback only needs to know
  // which of the two shapes to draw. Anything but 'grid' is the 'table' default
  // the params hook applies.
  const viewMode = searchParams.get('viewMode') === 'grid' ? 'grid' : 'table';

  return (
    <ContentErrorBoundary
      resetKey={resetKey}
      label="DevicesPanel"
      // Relay caches a failed query for five minutes, so clearing the boundary
      // alone would rethrow; the device epoch is this surface's `fetchKey`.
      onRetry={bumpDeviceEpoch}
      // The panel's header, back button and view switch are rendered by
      // `DevicesPanelContent`, i.e. inside what just threw — so the fallback
      // redraws that chrome rather than leaving a bare error where a page was.
      fallback={(retry, { isOffline }) => (
        <PageLayout
          title={chrome.title}
          backButton={chrome.backButton}
          actionsVariant="icon-buttons"
          className={cn(chrome.offsetClassName, chrome.className)}
          contentClassName="flex flex-col"
        >
          {/* `PageError`, not `LoadError`: this fallback has already redrawn the
              whole page, so the failure is page-weight here rather than a card
              inside surviving content. */}
          <PageError {...loadErrorProps(isOffline, "Couldn't load devices.", retry)} />
        </PageLayout>
      )}
    >
      <Suspense
        fallback={
          <DevicesPanelSkeleton
            {...chrome}
            viewMode={viewMode}
            hideColumns={props.hideColumns}
            hideFilters={props.hideFilters}
            archiveHref={props.archiveHref}
            showAddDevice={props.showAddDevice}
            noOrganizations={props.noOrganizations}
            isCheckingOrganizations={props.isCheckingOrganizations}
          />
        }
      >
        <DevicesPanelContent {...props} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
