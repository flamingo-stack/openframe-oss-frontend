'use client';

import {
  DEFAULT_DEVICES_LIST_STATUSES,
  getDeviceName,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { AutocompleteOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchDevicesPage } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { type EntityPickerProps, PickerField } from './picker-field';

const DEVICE_OPTIONS_LIMIT = 50;

/** The device a DEVICE exception is for, searched on the server like the ticket form's device picker. */
export function DevicePicker(props: EntityPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // One object for the cache key and the request.
  const filter = useMemo(() => ({ statuses: [...DEFAULT_DEVICES_LIST_STATUSES] }), []);
  const query = useQuery({
    queryKey: deviceQueryKeys.page(filter, debouncedSearch, DEVICE_OPTIONS_LIMIT),
    queryFn: () => fetchDevicesPage({ filter, search: debouncedSearch, first: DEVICE_OPTIONS_LIMIT }),
    placeholderData: keepPreviousData,
  });
  const options = useMemo<AutocompleteOption[]>(
    () =>
      (query.data?.devices ?? []).map(device => ({
        label: getDeviceName(device) || device.machineId,
        value: device.machineId,
      })),
    [query.data],
  );
  return (
    <PickerField
      {...props}
      options={options}
      onSearch={setSearch}
      loading={query.isLoading}
      error={query.isError ? "Couldn't load devices" : undefined}
    />
  );
}
