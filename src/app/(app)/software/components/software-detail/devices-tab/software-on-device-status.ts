import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SoftwareOnDeviceStatus } from '@/generated/schema-enums';
import { OUTDATED_TAG } from '../../shared/outdated-tag';

interface SoftwareOnDeviceStatusPresentation {
  /** The funnel option — and the chip, which `Tag` sets in capitals. */
  label: string;
  /**
   * The chip beside the device's version, or null for none. `UP_TO_DATE` has
   * none: the design marks only the states that need attention, and a green
   * "up to date" on every healthy row is noise.
   */
  tag: { variant: 'error' | 'warning' | 'outline'; inFlight?: boolean } | null;
}

/** Every per-device lifecycle state: how the funnel lists it and how the row marks it. */
export const SOFTWARE_ON_DEVICE_STATUS: Record<SoftwareOnDeviceStatus, SoftwareOnDeviceStatusPresentation> = {
  [SoftwareOnDeviceStatus.UP_TO_DATE]: { label: 'Up to date', tag: null },
  [SoftwareOnDeviceStatus.OUTDATED]: { label: OUTDATED_TAG.label, tag: { variant: OUTDATED_TAG.variant } },
  [SoftwareOnDeviceStatus.SCHEDULED_UPDATE]: { label: 'Scheduled update', tag: { variant: 'warning' } },
  // The one in-flight state: the loader glyph on the neutral outline, not a severity colour.
  [SoftwareOnDeviceStatus.UNINSTALLING]: { label: 'Uninstalling', tag: { variant: 'outline', inFlight: true } },
  [SoftwareOnDeviceStatus.SCHEDULED_UNINSTALL]: { label: 'Scheduled uninstall', tag: { variant: 'warning' } },
};

/**
 * The Status funnel's options — fixed, not a facet query. The backend only ever
 * derives two states (the device's version is the title's latest, or it is
 * not), and asking which of them occur cost a second full host scan per title,
 * as heavy as the rows themselves. The price: no per-option counts, and a state
 * no device is in is still offered. Extend this when the backend starts
 * reporting the scheduled / uninstalling states.
 */
export const SOFTWARE_ON_DEVICE_STATUS_OPTIONS: DataTableFilterOption[] = [
  SoftwareOnDeviceStatus.UP_TO_DATE,
  SoftwareOnDeviceStatus.OUTDATED,
].map(status => ({ id: status, value: status, label: SOFTWARE_ON_DEVICE_STATUS[status].label }));
