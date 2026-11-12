/**
 * Whether the backend's `DeviceStatus` enum has MANAGED (device status phase 2, CU-86akb8vvf).
 *
 * The frontend ships before the backend's phase 2 and must work against both: a phase-1 backend rejects MANAGED
 * in a filter (GraphQL enum coercion fails the whole query), while a phase-2 backend has devices that are MANAGED
 * and nothing else. `toRelayDeviceFilter` asks this before it expands the UI value MANAGED
 * (`expandDeviceStatuses`). Answered once per tab by `DeviceStatusSupportGate`, before any page renders.
 */
let managedSupported: boolean | null = null;

const STORAGE_KEY = 'of.deviceStatus.managedSupported';

/** The answer so far; false until it is known, which never sends a backend a value it may reject. */
export function isManagedStatusSupported(): boolean {
  return managedSupported === true;
}

/** Whether the question has been answered in this tab (from the probe or the tab's stored answer). */
export function isManagedStatusSupportKnown(): boolean {
  return managedSupported !== null;
}

/** For tests and the gate. */
export function setManagedStatusSupported(value: boolean | null): void {
  managedSupported = value;
}

/** The tab's stored answer, if any: a reload in the same tab need not ask again. */
export function readStoredManagedStatusSupport(): boolean | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === 'true' ? true : stored === 'false' ? false : null;
  } catch {
    return null;
  }
}

export function storeManagedStatusSupport(value: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private mode or blocked storage: the next load asks again.
  }
}
