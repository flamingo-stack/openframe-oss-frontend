'use client';

import { DevicesTableBody, matchesDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { ASSIGNED_DEVICES_TABLE_SETTINGS } from '@/app/components/shared/devices-panel/devices-table-settings';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { ASSIGNED_ITEMS_SKELETON_ROWS } from '../use-assigned-items';

interface DevicesAssignedTableProps {
  devices: Device[];
  isLoading?: boolean;
  /**
   * The table's layout. `grid` draws the lib's grid devices table (48px one-line rows, the device column pinned, the
   * gear menu), at its natural height: the list is a section of the item's page. Default `cards`.
   */
  tableLayout?: TableLayout;
}

export function DevicesAssignedTable({ devices, isLoading, tableLayout = 'cards' }: DevicesAssignedTableProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(d => {
      const org = (d.organization || '').toLowerCase();
      return matchesDeviceName(d, needle) || org.includes(needle);
    });
  }, [devices, debouncedSearch]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        userValue
        placeholder="Search for Device"
        value={search}
        onChange={e => setSearch(e.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
      />
      <DevicesTableBody
        devices={filtered}
        isLoading={isLoading}
        emptyState={oneLineEmptyState('No devices assigned.')}
        skeletonRows={ASSIGNED_ITEMS_SKELETON_ROWS}
        layout={tableLayout}
        tableSettings={tableLayout === 'grid' ? ASSIGNED_DEVICES_TABLE_SETTINGS : undefined}
      />
    </div>
  );
}
