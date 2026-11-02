'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  buildDevicePanelActions,
  type DeviceFilterInput,
  type DeviceFilters,
  DevicesPanelView,
  getDeviceActionsColumn,
  getDeviceFilterColumns,
  useTagFilterModal,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PageActionButton,
  PageError,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useContentMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo } from 'react';
import { DeviceActionsDropdown } from '@/app/(app)/devices/components/device-actions-dropdown';
import { DeviceFacets } from '@/app/(app)/devices/components/device-facets';
import { type UseDevicesResult, useDevices } from '@/app/(app)/devices/hooks/use-devices';
import { useDevicesUrlParams } from '@/app/(app)/devices/hooks/use-devices-url-params';
import { useGridInfiniteScroll } from '@/app/(app)/devices/hooks/use-grid-infinite-scroll';
import { useRowRemoteAccessPolicies } from '@/app/(app)/devices/hooks/use-remote-access-policy';
import { DEVICES_PAGE_SIZE } from '@/app/(app)/devices/queries/devices-api';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { bumpDeviceEpoch, useDeviceEpoch } from '@/app/(app)/devices/utils/device-refresh';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { ContentErrorBoundary } from '../content-error-boundary';
import { EMBEDDED_PAGE_OFFSET } from '../embedded-page';
import { NO_ITEMS } from '../no-next-page';
import { devicesViewMode } from './devices-view-mode';

/** The loaded table's actions column, minus the actions: the loading panel's columns take the same widths. */
const PENDING_ACTIONS_COLUMN = getDeviceActionsColumn<Device>();
/** The grid's filter row while the facets are out: every column with its static label, holding the row's height. */
const PENDING_FILTER_COLUMNS = getDeviceFilterColumns(null);

/** The per-row overflow menu. Post-action list refresh is handled centrally, so it takes no callback. */
function renderDeviceRowActions(device: Device): ReactNode {
  return <DeviceActionsDropdown device={device} context="table" />;
}

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
  /**
   * Drops the per-row actions dropdown, leaving only the open-in-new-tab arrow.
   * Used by the archive page: DELETED devices are read-only records.
   */
  readOnlyRows?: boolean;
}

function DevicesPanelContent(props: DevicesPanelProps) {
  const { lockedFilters, defaultStatuses } = props;
  const urlParams = useDevicesUrlParams({ defaultStatuses });
  const { filters: urlFilters, debouncedSearch } = urlParams;

  const filters = useMemo<DeviceFilterInput>(() => ({ ...urlFilters, ...lockedFilters }), [urlFilters, lockedFilters]);

  // The device queries suspend, and re-suspend whenever their variables change.
  // Deferring the variables makes a filter or search change a TRANSITION: React
  // keeps the current rows on screen while the next set loads, instead of
  // dropping the whole panel to its skeleton mid-interaction. The controls
  // themselves still read the live `params`, so a checkbox ticks immediately.
  const { deferredFilters, deferredSearch, isPending: isNarrowing } = useDeferredQuery(filters, debouncedSearch);

  const list = useDevices(deferredFilters, deferredSearch);
  const epoch = useDeviceEpoch();

  const renderPanel = (deviceFilters: DeviceFilters | null) => (
    <DevicesPanelLoaded
      panel={props}
      urlParams={urlParams}
      list={list}
      isNarrowing={isNarrowing}
      deviceFilters={deviceFilters}
    />
  );

  // The facets load with the rows (one Suspense boundary) but fail apart from them: a failed facet query used to
  // take the whole panel down while the list had answered. Now it costs only the filters, and the panel is drawn
  // without them. A different narrowing or a device mutation asks again.
  return (
    <ContentErrorBoundary
      label="DeviceFilters"
      resetKey={JSON.stringify([deferredFilters, epoch])}
      fallback={() => renderPanel(null)}
    >
      <DeviceFacets filters={deferredFilters}>{renderPanel}</DeviceFacets>
    </ContentErrorBoundary>
  );
}

interface DevicesPanelLoadedProps {
  panel: DevicesPanelProps;
  urlParams: ReturnType<typeof useDevicesUrlParams>;
  list: UseDevicesResult;
  isNarrowing: boolean;
  /** `null` when the facet query failed: no options, so no funnels, no grid filter row, an empty filter modal. */
  deviceFilters: DeviceFilters | null;
}

function DevicesPanelLoaded({ panel, urlParams, list, isNarrowing, deviceFilters }: DevicesPanelLoadedProps) {
  const {
    title = 'Devices',
    backButton,
    addDeviceHref = routes.devices.new(),
    showAddDevice = true,
    archiveHref,
    hideColumns,
    hideFilters,
    emptyMessage = 'No devices found. Try adjusting your search or filters.',
    className = '',
    embedded = false,
    emptyState,
    noOrganizations = false,
    isCheckingOrganizations = false,
    readOnlyRows = false,
  } = panel;
  const router = useRouter();

  const {
    params,
    setParam,
    setParams,
    localSearch,
    setLocalSearch,
    debouncedSearch,
    tableFilters,
    tagOptions,
    handleFilterChange,
    handleTagRemove,
    handleClearAll,
  } = urlParams;

  const { devices, isFetchingNextPage, hasNextPage, fetchNextPage, filteredCount } = list;
  // The grid where its switch is drawn, the table on a narrower page (`devicesViewMode`).
  const viewMode = devicesViewMode(params.viewMode, useContentMdUp());

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
  // The row menus disable Remote Control on DENY_ACCESS; only the table has them.
  useRowRemoteAccessPolicies(readOnlyRows || viewMode !== 'table' ? [] : devices);

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

  // Read-only lists keep the column (width parity with the skeleton) but render
  // nothing in it — rows offer only the open-in-new-tab arrow.
  const actionsColumn = useMemo<ColumnDef<Device>>(
    () => getDeviceActionsColumn<Device>(readOnlyRows ? undefined : renderDeviceRowActions),
    [readOnlyRows],
  );

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

  // Built from the declaration the Suspense fallback also reads, so the loading
  // header and the loaded one can't drift apart (see `devices-panel-header`).
  const actions = useMemo<PageActionButton[]>(
    () =>
      buildDevicePanelActions({
        archiveHref,
        showAddDevice,
        noOrganizations,
        addCustomerHref: routes.customers.new,
        isCheckingOrganizations,
        accent: showEmptyState && !noOrganizations,
        onAddDevice: () => router.push(addDeviceHref),
      }),
    [archiveHref, showAddDevice, showEmptyState, noOrganizations, isCheckingOrganizations, router, addDeviceHref],
  );

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);

  const gridSentinelRef = useGridInfiniteScroll({
    enabled: viewMode === 'grid',
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <DevicesPanelView<Device>
      pageSize={DEVICES_PAGE_SIZE}
      title={title}
      backButton={backButton}
      className={cn(embedded && EMBEDDED_PAGE_OFFSET, className)}
      viewMode={viewMode}
      onViewModeChange={mode => setParam('viewMode', mode)}
      actions={actions}
      noOrganizations={noOrganizations}
      emptyState={showEmptyState ? emptyState : undefined}
      isNarrowing={isNarrowing}
      devices={devices}
      totalCount={filteredCount}
      // The facet query suspends alongside the list, so by the time this renders
      // the facets are already in hand, or failed: nothing is pending on the loaded panel.
      deviceFilters={deviceFilters}
      filterColumns={filterColumns}
      toolbar={{
        searchValue: localSearch,
        onSearchChange: setLocalSearch,
        tags: tagOptions,
        onTagRemove: handleTagRemove,
        onClearAll: handleClearAll,
        onOpenFilterModal: openFilterModal,
        isFilterModalOpen: filterModalOpen,
        onCloseFilterModal: closeFilterModal,
        filterGroups,
        onFilterChange: handleModalFilterChange,
        currentFilters: isMdUp === false ? tableFilters : undefined,
        tagFilterKeys,
        selectedTags,
        onTagsChange: handleModalTagsChange,
      }}
      columnFilters={columnFilters}
      onColumnFiltersChange={onColumnFiltersChange}
      gridFilters={tableFilters}
      onGridFiltersChange={handleFilterChange}
      actionsColumn={actionsColumn}
      hideColumns={hideColumns}
      hideFilters={hideFilters}
      emptyMessage={emptyMessage}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={handleLoadMore}
      gridSentinelRef={gridSentinelRef}
    />
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
  const chrome: DevicesPanelChrome = {
    title: props.title ?? 'Devices',
    backButton: props.backButton,
    className: props.className,
    offsetClassName: props.embedded ? EMBEDDED_PAGE_OFFSET : undefined,
  };

  // Read straight off the URL rather than through `useDevicesUrlParams`: this
  // component sits OUTSIDE the boundary, and the fallback only needs to know
  // which of the two shapes to draw, by the rule the loaded list follows.
  const viewMode = devicesViewMode(searchParams.get('viewMode'), useContentMdUp());

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
      <DevicesPanelBody panel={props} chrome={chrome} viewMode={viewMode} />
    </ContentErrorBoundary>
  );
}

interface DevicesPanelChrome {
  title: string;
  backButton: DevicesPanelProps['backButton'];
  className: DevicesPanelProps['className'];
  offsetClassName: string | undefined;
}

interface DevicesPanelBodyProps {
  panel: DevicesPanelProps;
  chrome: DevicesPanelChrome;
  viewMode: 'table' | 'grid';
}

/** The panel's content, with its own boundary: in its scope the reader draws the panel's loading state. */
function DevicesPanelBody(props: DevicesPanelBodyProps) {
  return (
    <LoadingSuspense bare label="Loading devices">
      <DevicesPanelBodyReader {...props} />
    </LoadingSuspense>
  );
}

function DevicesPanelBodyReader(props: DevicesPanelBodyProps) {
  if (useLoadingScope()) return <DevicesPanelPending {...props} />;
  return <DevicesPanelContent {...props.panel} />;
}

/**
 * The panel's loading state, drawn by the panel: in a loading scope (an outer one, or its boundary's) it is its own
 * view in `loading`, with no query mounted. Everything here is a prop or a URL value, none of it the device
 * query: the header buttons come from the one declaration the loaded panel reads (`buildDevicePanelActions`), the
 * view switch reflects `?viewMode` (table and grid are different shapes), and the filter toolbar is the real one
 * with empty tags. Only what the request answers draws its loading form: the rows.
 */
function DevicesPanelPending({ panel: props, chrome, viewMode }: DevicesPanelBodyProps) {
  return (
    <DevicesPanelView<Device>
      pageSize={DEVICES_PAGE_SIZE}
      loading
      title={chrome.title}
      backButton={chrome.backButton}
      className={cn(chrome.offsetClassName, chrome.className)}
      viewMode={viewMode}
      actions={buildDevicePanelActions({
        archiveHref: props.archiveHref,
        showAddDevice: props.showAddDevice,
        noOrganizations: props.noOrganizations,
        isCheckingOrganizations: props.isCheckingOrganizations,
        addCustomerHref: routes.customers.new,
        disabled: true,
      })}
      devices={NO_ITEMS}
      filterColumns={PENDING_FILTER_COLUMNS}
      // The loaded table always carries a row-actions column, and it takes real width from the others.
      actionsColumn={PENDING_ACTIONS_COLUMN}
      hideColumns={props.hideColumns}
      hideFilters={props.hideFilters}
    />
  );
}
