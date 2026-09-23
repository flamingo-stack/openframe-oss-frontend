import { PackageManagerType, SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * The package managers the UI offers. Chocolatey is deliberately left out:
 * the backend still lists `CHOCO`, but the product ships Brew and WinGet only,
 * so no form offers it.
 */
export const PACKAGE_MANAGERS = [PackageManagerType.BREW, PackageManagerType.WINGET] as const;

export type SupportedPackageManager = (typeof PACKAGE_MANAGERS)[number];

export const PACKAGE_MANAGER_LABEL: Record<SupportedPackageManager, string> = {
  BREW: 'Brew',
  WINGET: 'WinGet',
};

/** The OS each catalog installs on — what narrows the device picker. */
export const PACKAGE_MANAGER_OS: Record<SupportedPackageManager, 'MAC_OS' | 'WINDOWS'> = {
  BREW: 'MAC_OS',
  WINGET: 'WINDOWS',
};

/** A run's package manager as the UI names it — the raw value for one no form offers. */
export function packageManagerLabel(value: string): string {
  return presentationFor(PACKAGE_MANAGER_LABEL, value) ?? value;
}

/**
 * Where the inventory found a title. The catalogs the UI offers read as they do
 * in the forms; Chocolatey still gets a name, because the inventory reports what
 * a device has regardless of what the product installs.
 */
export const SOFTWARE_SOURCE_LABEL: Record<SoftwareSource, string> = {
  [SoftwareSource.BREW]: PACKAGE_MANAGER_LABEL.BREW,
  [SoftwareSource.WINGET]: PACKAGE_MANAGER_LABEL.WINGET,
  [SoftwareSource.CHOCOLATEY]: 'Chocolatey',
  [SoftwareSource.UNMANAGED]: 'Unmanaged',
};
