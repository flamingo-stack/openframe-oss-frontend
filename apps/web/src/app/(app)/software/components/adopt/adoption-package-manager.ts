import {
  PACKAGE_MANAGER_LABEL,
  SOFTWARE_SOURCE_LABEL,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { PackageManagerType } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * Every package manager an adoption can name, as the forms and the inventory word them. Adoption reinstalls with
 * Homebrew on macOS and Chocolatey on Windows, which no install or update form offers, so the lib's form labels have
 * no Chocolatey: its name comes from the inventory's labels.
 */
const ADOPTION_PACKAGE_MANAGER_LABEL: Record<PackageManagerType, string> = {
  [PackageManagerType.BREW]: PACKAGE_MANAGER_LABEL.BREW,
  [PackageManagerType.WINGET]: PACKAGE_MANAGER_LABEL.WINGET,
  [PackageManagerType.CHOCO]: SOFTWARE_SOURCE_LABEL.CHOCOLATEY,
};

/** An adoption's package manager by name; the raw value for one this build does not know. */
export function adoptionPackageManagerLabel(manager: string): string {
  return presentationFor(ADOPTION_PACKAGE_MANAGER_LABEL, manager) ?? manager;
}
