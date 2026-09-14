import { PackageManagerType } from '@/generated/schema-enums';

export const PACKAGE_MANAGER_LABEL: Record<PackageManagerType, string> = {
  BREW: 'Brew',
  CHOCO: 'Chocolatey',
  WINGET: 'WinGet',
};

/** The OS each catalog installs on — what narrows the device picker. */
export const PACKAGE_MANAGER_OS: Record<PackageManagerType, 'MAC_OS' | 'WINDOWS'> = {
  BREW: 'MAC_OS',
  CHOCO: 'WINDOWS',
  WINGET: 'WINDOWS',
};

export const PACKAGE_MANAGERS = Object.values(PackageManagerType);
