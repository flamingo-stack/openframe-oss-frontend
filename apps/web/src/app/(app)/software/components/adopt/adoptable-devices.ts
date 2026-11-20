import type { SoftwareOnDeviceFilterInput } from '@/__generated__/softwareAdoptionBannerQuery.graphql';
import { SoftwareAdoptionStatus } from '@/generated/schema-enums';

/**
 * The devices an adoption is offered for: those where no package manager manages the title. `manageable: false`
 * rather than `installedBy: [UNMANAGED]`, so a device whose installer the inventory has not reported yet is not left
 * out; `adoptSoftware` itself drops a device its package manager cannot run on.
 */
export const ADOPTABLE_DEVICES_FILTER: SoftwareOnDeviceFilterInput = { manageable: false };

/** `adoptSoftware` takes 1..100 devices per call. */
export const ADOPT_DEVICE_LIMIT = 100;

/** A device whose adoption is queued or running: adopting it again would only queue a second order. */
export function isAdopting(status: string | null | undefined): boolean {
  return status === SoftwareAdoptionStatus.ADOPTING;
}
