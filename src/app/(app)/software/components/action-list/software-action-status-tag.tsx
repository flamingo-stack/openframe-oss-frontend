'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

interface ActionStatusPresentation {
  label: string;
  variant: 'warning' | 'success' | 'error' | 'outline';
  /** Still running — drawn with the loader glyph. */
  inFlight?: boolean;
}

/** Every Software Action status, exhaustively (see `presentationFor`). */
const SOFTWARE_ACTION_STATUS: Record<SoftwareActionStatus, ActionStatusPresentation> = {
  [SoftwareActionStatus.SCHEDULED]: { label: 'Scheduled', variant: 'warning' },
  [SoftwareActionStatus.IN_PROGRESS]: { label: 'In Progress', variant: 'outline', inFlight: true },
  [SoftwareActionStatus.COMPLETED]: { label: 'Success', variant: 'success' },
  [SoftwareActionStatus.FAILED]: { label: 'Failed', variant: 'error' },
};

/**
 * The backend's software branch renames COMPLETED to SUCCESS (openframe-oss-lib
 * 8b47068dc). A stand running that build ahead of our SDL sends a value the
 * table above does not know yet; it is the same state. Drop this once
 * `fetch-schema` brings the rename in and the table stops compiling.
 */
const RENAMED_ACTION_STATUS = { SUCCESS: SOFTWARE_ACTION_STATUS.COMPLETED };

/** How a status draws, under either spelling — undefined for one this build does not know. */
function statusPresentation(status: string): ActionStatusPresentation | undefined {
  return presentationFor(SOFTWARE_ACTION_STATUS, status) ?? presentationFor(RENAMED_ACTION_STATUS, status);
}

/** The status as the chip words it — the Status funnel says the same. */
export function softwareActionStatusLabel(status: string): string | undefined {
  return statusPresentation(status)?.label;
}

/** The STATUS chip of a Software Actions row. */
export function SoftwareActionStatusTag({ status }: { status: string }) {
  const presentation = statusPresentation(status);
  if (!presentation) return <Tag label={status} variant="grey" />;
  return (
    <Tag
      label={presentation.label}
      variant={presentation.variant}
      icon={presentation.inFlight ? <DotsLoaderIcon className="h-4 w-4" /> : undefined}
    />
  );
}
