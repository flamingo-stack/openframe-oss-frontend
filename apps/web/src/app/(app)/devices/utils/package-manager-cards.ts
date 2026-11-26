import { PackageManagerState, PackageManagerType } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';
import type { DevicePackageManager } from '../hooks/device-package-managers';

/** One card in the Agents tab's PACKAGE MANAGERS section. */
export interface PackageManagerCard {
  type: PackageManagerType;
  label: string;
  /** OpenFrame is installing it: the card says PENDING and has no version yet. */
  pending: boolean;
  version: string | null;
  versionChangedAt: Instant | null;
}

/** The names the cards use (Figma: "Homebrew", where the software forms say "Brew"). */
export const PACKAGE_MANAGER_CARD_LABEL: Record<PackageManagerType, string> = {
  [PackageManagerType.CHOCO]: 'Chocolatey',
  [PackageManagerType.WINGET]: 'WinGet',
  [PackageManagerType.BREW]: 'Homebrew',
};

/** The order of the cards: Windows' two first (Chocolatey, then WinGet), then the Mac's. */
const CARD_ORDER: readonly PackageManagerType[] = [
  PackageManagerType.CHOCO,
  PackageManagerType.WINGET,
  PackageManagerType.BREW,
];

/**
 * The cards for a device's package managers. A manager gets a card only when OpenFrame runs it on this device
 * (`managed`) and it is either installed or being installed by OpenFrame. A manager OpenFrame does not run (another OS,
 * an unsupported edition, Chocolatey turned off), one missing or unreadable that nothing is installing, and one whose
 * install failed get none. `null` (a backend without the field) and `undefined` (not read yet) give no cards.
 */
export function packageManagerCards(
  managers: readonly DevicePackageManager[] | null | undefined,
): PackageManagerCard[] {
  if (!managers) return [];
  return managers
    .filter(manager => manager.managed && (manager.installing || manager.state === PackageManagerState.PRESENT))
    .sort((a, b) => CARD_ORDER.indexOf(a.type) - CARD_ORDER.indexOf(b.type))
    .map(manager => ({
      type: manager.type,
      label: PACKAGE_MANAGER_CARD_LABEL[manager.type] ?? manager.type,
      pending: manager.installing,
      version: manager.installing ? null : manager.version,
      versionChangedAt: manager.installing ? null : manager.versionChangedAt,
    }));
}
