'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useOrganizationOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { DEFAULT_DEVICES_LIST_STATUSES } from '../constants/device-statuses';
import { fetchDevicesPage } from '../queries/devices-api';
import { getDeviceName } from '../utils/device-name';
import { deviceQueryKeys } from '../utils/query-keys';

/** The header funnel lists every device by name; a fleet past this size shows its first devices. */
const DEVICE_OPTIONS_LIMIT = 100;

interface FilterOption {
  id: string;
  value: string;
  label: string;
}

/**
 * The DEVICE and CUSTOMER funnels of the tenant-wide Remote Sessions page.
 * The sessions API has no facets, so the options are the tenant's devices (the
 * same fleet the Devices list shows) and customers; the values are what the
 * session filter takes - the device's machine id and the organization id.
 */
export function useTenantSessionFilterOptions() {
  const deviceFilter = useMemo(() => ({ statuses: [...DEFAULT_DEVICES_LIST_STATUSES] }), []);
  const devices = useQuery({
    queryKey: deviceQueryKeys.page(deviceFilter, '', DEVICE_OPTIONS_LIMIT),
    queryFn: () => fetchDevicesPage({ filter: deviceFilter, first: DEVICE_OPTIONS_LIMIT }),
  });
  const customers = useOrganizationOptions('');

  const deviceOptions = useMemo<FilterOption[]>(
    () =>
      (devices.data?.devices ?? [])
        .map(device => {
          const label = getDeviceName(device) || device.machineId;
          return { id: device.machineId, value: device.machineId, label };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [devices.data],
  );
  const customerOptions = useMemo<FilterOption[]>(
    () => customers.options.map(option => ({ id: option.value, value: option.value, label: option.label })),
    [customers.options],
  );

  return { deviceOptions, customerOptions, pending: devices.isLoading || customers.isLoading };
}
