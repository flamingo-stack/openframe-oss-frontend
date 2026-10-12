'use client';

import { DevicesTableBody, matchesDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import type { Device } from '@/app/(app)/devices/types/device.types';

interface DevicesAssignedTableProps {
  devices: Device[];
  isLoading?: boolean;
  onSearchChange?: (search: string) => void;
}

export function DevicesAssignedTable({ devices, isLoading, onSearchChange }: DevicesAssignedTableProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useMemo(() => {
    onSearchChange?.(debouncedSearch.trim());
  }, [debouncedSearch, onSearchChange]);

  const filtered = useMemo(() => {
    if (onSearchChange) return devices;
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(d => {
      const org = (d.organization || '').toLowerCase();
      return matchesDeviceName(d, needle) || org.includes(needle);
    });
  }, [devices, debouncedSearch, onSearchChange]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-mf)]">
      <Input
        placeholder="Search for Device"
        value={search}
        onChange={e => setSearch(e.target.value)}
        startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
      />
      <DevicesTableBody devices={filtered} isLoading={isLoading} emptyMessage="No devices assigned." skeletonRows={3} />
    </div>
  );
}

