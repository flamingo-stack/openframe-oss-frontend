'use client';

import type { InfoCardData } from '@flamingo-stack/openframe-frontend-core';
import { InfoCard, ToolIcon } from '@flamingo-stack/openframe-frontend-core';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { normalizeToolTypeWithFallback, toToolLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import { EMPTY_CARD } from '@/app/components/shared/info-card-loading';
import type { LogEntry } from '../../logs-page/types/log.types';

interface FullInformationSectionProps {
  logDetails?: LogEntry | null;
}

/** The card's row labels, in its order: ONE table, read by the loaded card and by its loading shape. */
const ROW = {
  toolEventId: 'toolEventId',
  ingestDay: 'ingestDay',
  toolType: 'toolType',
  eventType: 'eventType',
  severity: 'severity',
  userId: 'userId',
  deviceId: 'deviceId',
  timestamp: 'timestamp',
} as const;

/**
 * The card's loading shape: the rows a typical log carries, their labels real, no title (the loaded card has none).
 * Most logs come from a device, so `deviceId` is drawn; `userId` appears only on some, so it is left out.
 */
const LOADING_SKELETON = {
  rows: [ROW.toolEventId, ROW.ingestDay, ROW.toolType, ROW.eventType, ROW.severity, ROW.deviceId, ROW.timestamp],
  title: false,
};

export function FullInformationSection({ logDetails }: FullInformationSectionProps) {
  // In a loading scope the card has no rows yet: `InfoCard` draws its own skeleton, its row labels real.
  const loading = useLoadingScope();
  if (!loading && !logDetails) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="w-full text-ods-text-secondary text-h5">Full Information</div>
        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-[6px] border border-ods-border bg-ods-card p-8">
          <div className="text-center text-ods-text-secondary">No log details available</div>
        </div>
      </div>
    );
  }

  const data: InfoCardData =
    loading || !logDetails
      ? EMPTY_CARD
      : {
          items: [
            { label: ROW.toolEventId, value: logDetails.toolEventId },
            { label: ROW.ingestDay, value: logDetails.ingestDay },
            {
              label: ROW.toolType,
              value: toToolLabel(logDetails.toolType),
              icon: <ToolIcon toolType={normalizeToolTypeWithFallback(logDetails.toolType)} size={16} />,
            },
            { label: ROW.eventType, value: logDetails.eventType },
            { label: ROW.severity, value: logDetails.severity },
            ...(logDetails.userId ? [{ label: ROW.userId, value: logDetails.userId }] : []),
            ...(logDetails.deviceId ? [{ label: ROW.deviceId, value: logDetails.deviceId }] : []),
            // The wire value, like every other row here — the formatted date is in the page header.
            { label: ROW.timestamp, value: logDetails.timestamp },
          ],
        };

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Section Title */}
      <div className="w-full text-ods-text-secondary text-h5">Full Information</div>

      {/* Info Card */}
      <InfoCard data={data} skeleton={LOADING_SKELETON} />
    </div>
  );
}
