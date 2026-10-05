import { useMemo } from 'react';
import { DEVICE_STATUS } from '../../../devices/constants/device-statuses';
import { useAllDevices } from '../../../devices/hooks/use-all-devices';
import type { Device, DeviceFilterInput } from '../../../devices/types/device.types';
import { getFleetHostId, indexDevicesByFleetHostId } from '../../../devices/utils/device-action-utils';

const POLICY_DEVICE_FILTER: DeviceFilterInput = { statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE] };

/**
 * The device pool offered by the policy / query device selectors.
 *
 * Fleet-connected devices are collapsed to one row per Fleet host (a re-enrolled
 * machine leaves several device records behind the same host); devices with no
 * Fleet connection are listed as they are.
 */
export function usePolicyDevices() {
  const { devices: allDevices, isLoading } = useAllDevices({ filter: POLICY_DEVICE_FILTER });

  const devices = useMemo(() => {
    const nonFleetDevices = allDevices.filter(device => getFleetHostId(device) === undefined);
    const fleetDevices: Device[] = Array.from(indexDevicesByFleetHostId(allDevices).values());
    return [...fleetDevices, ...nonFleetDevices];
  }, [allDevices]);

  return { devices, isLoading };
}
