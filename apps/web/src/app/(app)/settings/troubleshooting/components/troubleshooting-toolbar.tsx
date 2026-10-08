'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CheckboxBlock, Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceLogLevelChips } from '@/app/(app)/devices/components/tabs/device-logs/device-log-level-chips';
import { DeviceLogRangeSelect } from '@/app/(app)/devices/components/tabs/device-logs/device-log-range-select';
import type { DeviceLogFilters } from '@/app/(app)/devices/hooks/use-device-log-filters';
import { DeviceFilter } from './device-filter';

interface TroubleshootingToolbarProps {
  /** The picked machineIds; empty = every device in the tenant. */
  devices: string[];
  onDevicesChange: (devices: string[]) => void;
  filters: DeviceLogFilters;
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
}

/**
 * The pickers and Auto-Update in one row, the search box under
 * them, the level chips last. Refresh is the page header's. Outside the list's
 * Suspense so the search box keeps focus.
 *
 * The row is laid out for one more cell: "Show All Customers" goes first once
 * `deviceLogs` filters by customer.
 */
export function TroubleshootingToolbar({
  devices,
  onDevicesChange,
  filters,
  autoUpdate,
  onAutoUpdateChange,
}: TroubleshootingToolbarProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-mf)] content-md:grid-cols-2 content-lg:grid-cols-3">
        <DeviceFilter value={devices} onChange={onDevicesChange} />
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
