'use client';

import type { InfoCardData } from '@flamingo-stack/openframe-frontend-core';
import { InfoCard, ToolIcon } from '@flamingo-stack/openframe-frontend-core';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { normalizeToolTypeWithFallback, toToolLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import type { LogEntry } from '../../logs-page/types/log.types';

interface FullInformationSectionProps {
  logDetails?: LogEntry | null;
}

const NO_ITEMS: InfoCardData['items'] = [];

export function FullInformationSection({ logDetails }: FullInformationSectionProps) {
  // In a loading scope the card has no rows yet: `InfoCard` draws its own skeleton under the real title.
  if (useLoadingScope()) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="w-full text-ods-text-secondary text-h5">Full Information</div>
        <InfoCard data={{ items: NO_ITEMS }} />
      </div>
    );
  }
  if (!logDetails) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="w-full text-ods-text-secondary text-h5">Full Information</div>
        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-[6px] border border-ods-border bg-ods-card p-8">
          <div className="text-center text-ods-text-secondary">No log details available</div>
        </div>
      </div>
    );
  }

  const items: InfoCardData['items'] = [
    { label: 'toolEventId', value: logDetails.toolEventId },
    { label: 'ingestDay', value: logDetails.ingestDay },
    {
      label: 'toolType',
      value: toToolLabel(logDetails.toolType),
      icon: <ToolIcon toolType={normalizeToolTypeWithFallback(logDetails.toolType)} size={16} />,
    },
    { label: 'eventType', value: logDetails.eventType },
    { label: 'severity', value: logDetails.severity },
    ...(logDetails.userId ? [{ label: 'userId', value: logDetails.userId }] : []),
    ...(logDetails.deviceId ? [{ label: 'deviceId', value: logDetails.deviceId }] : []),
    // The wire value, like every other row here — the formatted date is in the page header.
    { label: 'timestamp', value: logDetails.timestamp },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Section Title */}
      <div className="w-full text-ods-text-secondary text-h5">Full Information</div>

      {/* Info Card */}
      <InfoCard data={{ items }} />
    </div>
  );
}
