'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  const label = status ? (presentationFor(AUTO_UPDATE_LABEL, status) ?? null) : null;
  // Nothing to auto-update with is a fact about the title, not a setting: it reads muted, as on the tablet frame
  // (1098:309), so the On / Off rows stand out.
  if (status === SoftwareAutoUpdateStatus.NO_PACKAGE) {
    return (
      <TruncateText variant="h6" tone="secondary">
        {label ?? ''}
      </TruncateText>
    );
  }
  return <ValueText value={label} />;
}

/**
 * The word an AUTO-UPDATE funnel offers a state under, as its cells word it: null for NEEDS_ADOPTION, which has none
 * (the empty mark until there is an Adopt), so it is not offered; undefined for a state this build does not know.
 */
export function autoUpdateFilterLabel(status: string): string | null | undefined {
  return presentationFor(AUTO_UPDATE_LABEL, status);
}
