'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CheckboxBlock, Input, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { DeviceLogLevelChips } from '@/app/(app)/devices/components/tabs/device-logs/device-log-level-chips';
import { DeviceLogRangeSelect } from '@/app/(app)/devices/components/tabs/device-logs/device-log-range-select';
import type { DeviceLogFilters } from '@/app/(app)/devices/hooks/use-device-log-filters';
import { OrganizationFilter } from '@/app/(app)/tickets/components/organization-filter';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { TROUBLESHOOTING_PICK_LIMIT } from '../utils/troubleshooting-params';
import { DeviceFilter } from './device-filter';

interface TroubleshootingToolbarProps {
  /**
   * Whether "Show All Customers" is offered. `loading` keeps its cell as a
   * placeholder so the row does not re-flow when the answer lands.
   */
  customerFilter: FeatureFlagGate;
  /** The picked customers' organizationIds; empty = every customer. */
  customers: string[];
  onCustomersChange: (customers: string[]) => void;
  /** The picked machineIds; empty = every device in the tenant. */
  devices: string[];
  onDevicesChange: (devices: string[]) => void;
  filters: DeviceLogFilters;
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
}

/**
 * The pickers and Auto-Update in one row, the search box under them, the level
 * chips last. Refresh is the page header's. Outside the list's Suspense so the
 * search box keeps focus.
 */
export function TroubleshootingToolbar({
  customerFilter,
  customers,
  onCustomersChange,
  devices,
  onDevicesChange,
  filters,
  autoUpdate,
  onAutoUpdateChange,
}: TroubleshootingToolbarProps) {
  // The device picker offers the picked customers' devices only, once the customer filter is live.
  const organizationIds = customerFilter === 'on' && customers.length > 0 ? customers : undefined;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div
        className={cn(
          'grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2',
          customerFilter === 'off' ? 'content-lg:grid-cols-3' : 'content-lg:grid-cols-4',
        )}
      >
        {customerFilter === 'on' && (
          <OrganizationFilter value={customers} onChange={onCustomersChange} maxItems={TROUBLESHOOTING_PICK_LIMIT} />
        )}
        {customerFilter === 'loading' && <Skeleton className="h-12 rounded-md" aria-hidden="true" />}
        <DeviceFilter value={devices} onChange={onDevicesChange} organizationIds={organizationIds} />
        <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
          <DeviceLogRangeSelect
            range={filters.range}
            onRangeChange={filters.changeRange}
            customRange={filters.customRange}
            onCustomRangeChange={filters.changeCustomRange}
            pickerBounds={filters.pickerBounds}
            triggerClassName="min-w-[180px] flex-1"
            pickerClassName="min-w-[220px] flex-1"
          />
        </div>
        <CheckboxBlock
          id="troubleshooting-auto-update"
          label="Auto-Update"
          checked={autoUpdate}
          onCheckedChange={onAutoUpdateChange}
          truncateLabel
        />
      </div>
      <Input
        placeholder="Search for Log"
        aria-label="Search device logs"
        value={filters.search}
        onChange={event => filters.setSearch(event.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
        error={filters.searchError ?? undefined}
      />
      <DeviceLogLevelChips selectedLevels={filters.selectedLevels} onToggleLevel={filters.toggleLevel} />
    </div>
  );
}
