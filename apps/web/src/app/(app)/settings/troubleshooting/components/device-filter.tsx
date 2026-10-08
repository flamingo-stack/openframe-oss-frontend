'use client';

import { Filter02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Autocomplete, type AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { DEFAULT_DEVICES_LIST_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { fetchDevicesPage } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { sortDevicesLiveFirst, toDeviceOption } from '../utils/device-option';
import { TROUBLESHOOTING_PICK_LIMIT } from '../utils/troubleshooting-params';

const OPTIONS_LIMIT = 50;

interface DeviceFilterProps {
  /** machineIds, as the URL carries them. */
  value: string[];
  onChange: (value: string[]) => void;
  /** The picked customers: the list offers their devices only. Omitted = the whole fleet. */
  organizationIds?: readonly string[];
  disabled?: boolean;
  className?: string;
}

/**
 * "Show All Devices": the fleet searched server-side, up to the API's 50 per
 * query. Same imperative page fetch as the ticket form's picker, through
 * react-query so the open list keeps its rows while the next search resolves.
 */
export function DeviceFilter({ value, onChange, organizationIds, disabled, className }: DeviceFilterProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // One object for the cache key and the request, as the ticket form's device picker does.
  const filter = useMemo(
    () => ({
      statuses: [...DEFAULT_DEVICES_LIST_STATUSES],
      ...(organizationIds && { organizationIds: [...organizationIds] }),
    }),
    [organizationIds],
  );
  const query = useQuery({
    queryKey: deviceQueryKeys.page(filter, debouncedSearch, OPTIONS_LIMIT),
    queryFn: () => fetchDevicesPage({ filter, search: debouncedSearch, first: OPTIONS_LIMIT }),
    placeholderData: keepPreviousData,
  });
  const fetched = useMemo(() => sortDevicesLiveFirst(query.data?.devices ?? []).map(toDeviceOption), [query.data]);

  // The options a chip was picked from, so it keeps its name after the search moves
  // on. A device restored from a shared link that no search has returned yet shows
  // its machineId — the control's own fallback — until it does.
  const [picked, setPicked] = useState<ReadonlyMap<string, AutocompleteOption>>(() => new Map());
  const options = useMemo(() => {
    const byValue = new Map(fetched.map(option => [option.value, option]));
    for (const id of value) {
      const known = picked.get(id);
      if (known && !byValue.has(id)) byValue.set(id, known);
    }
    return [...byValue.values()];
  }, [fetched, picked, value]);

  const handleChange = (next: string[]) => {
    const added = next.filter(id => !value.includes(id));
    if (added.length > 0) {
      setPicked(previous => {
        const merged = new Map(previous);
        for (const id of added) {
          const option = options.find(candidate => candidate.value === id);
          if (option) merged.set(id, option);
        }
        return merged;
      });
    }
    onChange(next);
  };

  return (
    <Autocomplete
      multiple
      options={options}
      value={value}
      onChange={handleChange}
      onInputChange={setSearch}
      disableClientFilter
      placeholder="Show All Devices"
      loading={query.isLoading}
      error={query.isError ? "Couldn't load devices" : undefined}
      maxItems={TROUBLESHOOTING_PICK_LIMIT}
      startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
      disabled={disabled}
      className={className}
    />
  );
}
