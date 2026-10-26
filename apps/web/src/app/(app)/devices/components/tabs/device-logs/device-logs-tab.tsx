'use client';

import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useDeferredLogList } from '../../../hooks/use-deferred-log-list';
import { DEVICE_LOG_PARAM_SCHEMA, useDeviceLogFilters } from '../../../hooks/use-device-log-filters';
import type { Device } from '../../../types/device.types';
import { DeviceLogDrawer } from './device-log-drawer';
import type { DeviceLogEntry } from './device-log-row';
import { DeviceLogsList } from './device-logs-list';
import { DeviceLogsToolbar } from './device-logs-toolbar';

interface DeviceLogsTabProps {
  /** Null while the device is read: the tab is drawn in the page's loading scope. */
  device: Device | null;
}

/** Device details → Device Logs. Filters ride the URL under `log*` keys, apart from the Overview logs table's. */
export function DeviceLogsTab({ device }: DeviceLogsTabProps) {
  // The device has not answered: the toolbar draws locked and the list its own skeleton.
  const loading = useLoadingScope();
  const machineId = device?.machineId || device?.id || '';
  const filters = useDeviceLogFilters(useApiParams(DEVICE_LOG_PARAM_SCHEMA));
  const { filter, anchor } = filters;

  // The anchor is part of the key: a custom range does not depend on it, and Refresh must still make a new list.
  const list = useMemo(
    () => ({ key: `${machineId}|${anchor}|${JSON.stringify(filter)}`, machineIds: [machineId], filter }),
    [machineId, anchor, filter],
  );
  const { deferredList, isPending } = useDeferredLogList(list);

  const [autoUpdate, setAutoUpdate] = useState(true);
  // Kept here, above the list: the list remounts per filter, and an open drawer should not close with it.
  const [selected, setSelected] = useState<{ key: string; entry: DeviceLogEntry } | null>(null);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <DeviceLogsToolbar
        search={filters.search}
        onSearchChange={filters.setSearch}
        searchError={filters.searchError}
        selectedLevels={filters.selectedLevels}
        onToggleLevel={filters.toggleLevel}
        range={filters.range}
        onRangeChange={filters.changeRange}
        customRange={filters.customRange}
        onCustomRangeChange={filters.changeCustomRange}
        pickerBounds={filters.pickerBounds}
        autoUpdate={autoUpdate}
        onAutoUpdateChange={setAutoUpdate}
        onRefresh={filters.refresh}
        isRefreshing={isPending}
        disabled={loading}
      />
      {/* The deferred key: the live one would remount a failed list and re-send it. */}
      <ContentErrorBoundary label="DeviceLogsTab" message="Couldn't load device logs." resetKey={deferredList.key}>
        {/* The deferred list trails the live one by the debounce: right after the device answers it still holds the
            empty machine id the loading state was built with. The list stays in its loading form (and asks for
            nothing) until the deferred list carries the real one. */}
        <LoadingWhen loading={!deferredList.machineIds[0]}>
          <DeviceLogsList
            listKey={deferredList.key}
            machineIds={deferredList.machineIds}
            filter={deferredList.filter}
            deviceHostname={device?.hostname}
            isPending={isPending}
            autoUpdate={autoUpdate && !filters.rangeClosed}
            hasFilters={filters.hasFilters}
            onResetFilters={filters.resetFilters}
            selectedKey={selected?.key ?? null}
            onSelect={(key, entry) => setSelected({ key, entry })}
          />
        </LoadingWhen>
      </ContentErrorBoundary>
      {device && (
        <DeviceLogDrawer entry={selected?.entry ?? null} onClose={() => setSelected(null)} deviceId={machineId} />
      )}
    </div>
  );
}
