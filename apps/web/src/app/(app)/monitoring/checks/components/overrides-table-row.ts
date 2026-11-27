import type { Check, CheckOverride } from '../utils/check-transform';

/** What an exception row does, for an admin or owner; a reader's rows have none. */
export interface OverrideRowActions {
  busy: boolean;
  edit: () => void;
  delete: () => void;
}

/** The customer's devices or the device itself; none for a tag, which the device list cannot filter by alone. */
export interface OverrideDevicesTarget {
  label: string;
  href: string;
}

export interface OverrideTableRow {
  id: string;
  check: Check;
  override: CheckOverride;
  devices: OverrideDevicesTarget | null;
  actions: OverrideRowActions | null;
}
