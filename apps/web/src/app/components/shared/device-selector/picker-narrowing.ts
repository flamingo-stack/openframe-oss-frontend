import type { deviceSelectorFields_machine$key } from '@/__generated__/deviceSelectorFields_machine.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { machineSelectorToDevice } from '@/app/(app)/devices/utils/device-transform';

/** How many devices each half of a server-driven picker loads per page. */
export const DEVICE_PICKER_PAGE_SIZE = 20;

type MachineEdges = ReadonlyArray<
  { readonly node?: deviceSelectorFields_machine$key | null } | null | undefined
> | null;

/** Connection edges → table rows, skipping any dangling (store-evicted) edge. */
export function toDevices(edges: MachineEdges | undefined): Device[] {
  return (edges ?? []).flatMap(edge => (edge?.node ? [machineSelectorToDevice(edge.node)] : []));
}
