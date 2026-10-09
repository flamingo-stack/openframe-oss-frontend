'use client';

import { Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { defineParamSchema } from '@flamingo-stack/openframe-frontend-core/utils';
import { Suspense, useMemo, useState } from 'react';
import { DeviceLogDrawer } from '@/app/(app)/devices/components/tabs/device-logs/device-log-drawer';
import type { DeviceLogEntry } from '@/app/(app)/devices/components/tabs/device-logs/device-log-row';
import { DeviceLogsList } from '@/app/(app)/devices/components/tabs/device-logs/device-logs-list';
import { DeviceLogsListSkeleton } from '@/app/(app)/devices/components/tabs/device-logs/device-logs-skeleton';
import { useDeferredLogList } from '@/app/(app)/devices/hooks/use-deferred-log-list';
import {
  deviceLogParamReset,
  deviceLogParamSchema,
  useDeviceLogFilters,
} from '@/app/(app)/devices/hooks/use-device-log-filters';
import type { DeviceLogPreset } from '@/app/(app)/devices/utils/device-log-time';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { pickedIdsFromParams } from '../utils/troubleshooting-params';
import { TroubleshootingToolbar } from './troubleshooting-toolbar';

/**
 * A tenant-wide list opens on the last hour: a day of every device's lines is a
 * firehose, and the trouble being looked for is usually happening now.
 */
const DEFAULT_RANGE: DeviceLogPreset = '1h';

// The log params with the page's own: see `deviceLogParamSchema`.
const PARAM_SCHEMA = defineParamSchema({
  ...deviceLogParamSchema(DEFAULT_RANGE),
  customer: { type: 'array', default: [] },
  device: { type: 'array', default: [] },
});

/** Under a customer filter the API skips lines whose agent does not report its customer yet. */
const CUSTOMER_EMPTY_DESCRIPTION =
  'Nothing from these customers matched the current range and filters. Lines from agents that do not report their customer yet are not included.';

/**
 * Settings → Troubleshooting: every device's logs in one list, narrowed to the
 * picked customers and devices. The same list, drawer and filter controls as a
 * device's Device Logs tab, over `deviceLogs(machineIds:, organizationIds:)`
 * with both omitted for the whole tenant.
 */
export function TroubleshootingView() {
  const handleBack = useSafeBack(routes.settings.root());
  // Tri-state: a `customer` param must not reach the query before the flag has answered.
  const customerFilter = useFeatureFlagGate('device-logs-customer-filter');
  // The intent, not the URL, for the pickers and the list alike: see `useDeviceLogFilters`.
  const { pendingParams, setParam, setParams } = useApiParams(PARAM_SCHEMA);
  const filters = useDeviceLogFilters({ pendingParams, setParam, setParams }, { defaultRange: DEFAULT_RANGE });
  const { filter, anchor } = filters;

  const machineIds = useMemo(() => pickedIdsFromParams(pendingParams.device), [pendingParams.device]);
  // Off = the param is ignored, not sent: a link from an environment with the filter must still open here.
  const organizationIds = useMemo(
    () => (customerFilter === 'on' ? pickedIdsFromParams(pendingParams.customer) : undefined),
    [customerFilter, pendingParams.customer],
  );
  // The anchor is part of the key: a custom range does not depend on it, and Refresh must still make a new list.
  const list = useMemo(
    () => ({
      key: `${organizationIds?.join(',') ?? ''}|${machineIds?.join(',') ?? ''}|${anchor}|${JSON.stringify(filter)}`,
      machineIds,
      organizationIds,
      filter,
    }),
    [machineIds, organizationIds, anchor, filter],
  );
  const { deferredList, isPending } = useDeferredLogList(list);

  const [autoUpdate, setAutoUpdate] = useState(true);
  // Kept here, above the list: the list remounts per filter, and an open drawer should not close with it.
  const [selected, setSelected] = useState<{ key: string; entry: DeviceLogEntry } | null>(null);

  const hasFilters = filters.hasFilters || machineIds !== undefined || organizationIds !== undefined;
  const resetFilters = () => {
    filters.setSearch('');
    // One write for every param: a second `setParams` would re-base on a URL the first has not reached.
    setParams({ ...deviceLogParamReset(DEFAULT_RANGE), customer: [], device: [] });
  };

  const actions: PageActionButton[] = [
    {
      label: 'Refresh',
      icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
      variant: 'outline',
      onClick: filters.refresh,
      disabled: isPending,
    },
  ];

  return (
    <PageLayout
      title="Troubleshooting"
      actions={actions}
      backButton={{ label: 'Back', onClick: handleBack }}
      className="bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <TroubleshootingToolbar
        customerFilter={customerFilter}
        customers={pendingParams.customer}
        onCustomersChange={customers => setParam('customer', customers)}
        devices={pendingParams.device}
        onDevicesChange={devices => setParam('device', devices)}
        filters={filters}
        autoUpdate={autoUpdate}
        onAutoUpdateChange={setAutoUpdate}
      />
      {/* The deferred key: the live one would remount a failed list and re-send it. */}
      <ContentErrorBoundary label="Troubleshooting" message="Couldn't load device logs." resetKey={deferredList.key}>
        <Suspense fallback={<DeviceLogsListSkeleton />}>
          <DeviceLogsList
            key={deferredList.key}
            machineIds={deferredList.machineIds}
            organizationIds={deferredList.organizationIds}
            filter={deferredList.filter}
            isPending={isPending}
            autoUpdate={autoUpdate && !filters.rangeClosed}
            hasFilters={hasFilters}
            onResetFilters={resetFilters}
            emptyDescription={deferredList.organizationIds ? CUSTOMER_EMPTY_DESCRIPTION : undefined}
            selectedKey={selected?.key ?? null}
            onSelect={(key, entry) => setSelected({ key, entry })}
          />
        </Suspense>
      </ContentErrorBoundary>
      <DeviceLogDrawer entry={selected?.entry ?? null} onClose={() => setSelected(null)} />
    </PageLayout>
  );
}
