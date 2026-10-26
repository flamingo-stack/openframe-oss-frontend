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
