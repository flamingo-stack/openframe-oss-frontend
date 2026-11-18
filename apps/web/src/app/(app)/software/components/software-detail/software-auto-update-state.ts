import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';

/**
 * A package manager manages the title (auto-update ON or OFF): it can be updated through its package and kept
 * auto-updated. NO_PACKAGE has no package to do either with, NEEDS_ADOPTION has to be adopted first (no Adopt yet), and
 * null is a title the read model has not matched.
 */
export function isManagedTitle(status: string | null | undefined): boolean {
  return status === SoftwareAutoUpdateStatus.ON || status === SoftwareAutoUpdateStatus.OFF;
}
