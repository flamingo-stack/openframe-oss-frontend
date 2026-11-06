'use client';

import { ValueText } from '@/app/components/shared/value-text';
import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * Every auto-update state as the AUTO-UPDATE columns word it (see `presentationFor`): null draws the empty mark.
 */
const AUTO_UPDATE_LABEL: Record<SoftwareAutoUpdateStatus, string | null> = {
  // An auto-update policy keeps it updated.
  [SoftwareAutoUpdateStatus.ON]: 'On',
  // A package manager installed it, but no policy covers it.
  [SoftwareAutoUpdateStatus.OFF]: 'Off',
  // No package manager has a package for it: nothing to auto-update with.
  [SoftwareAutoUpdateStatus.NO_PACKAGE]: 'No package found',
  // Installed by hand: it needs adopting first.
  [SoftwareAutoUpdateStatus.NEEDS_ADOPTION]: null,
};

/** An AUTO-UPDATE cell: On, Off, "No package found", or the empty mark (unknown, or installed by hand). */
export function AutoUpdateStatusValue({ status }: { status: string | null | undefined }) {
  return <ValueText value={status ? (presentationFor(AUTO_UPDATE_LABEL, status) ?? null) : null} />;
}
