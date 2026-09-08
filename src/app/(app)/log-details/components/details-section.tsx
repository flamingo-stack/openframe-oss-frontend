'use client';

import type { LogEntry } from '../../logs-page/types/log.types';

interface DetailsSectionProps {
  logDetails: LogEntry;
}

export function DetailsSection({ logDetails }: DetailsSectionProps) {
  // Parse details JSON if available, otherwise show structured log data
  let detailsData;
  try {
    detailsData = logDetails.details
      ? JSON.parse(logDetails.details)
      : {
          toolEventId: logDetails.toolEventId,
          eventType: logDetails.eventType,
          toolType: logDetails.toolType,
          severity: logDetails.severity,
          userId: logDetails.userId,
          deviceId: logDetails.deviceId,
          timestamp: logDetails.timestamp,
          ingestDay: logDetails.ingestDay,
          message: logDetails.message,
        };
  } catch (_error) {
    // If details is not valid JSON, create a structured object
    detailsData = {
      toolEventId: logDetails.toolEventId,
      eventType: logDetails.eventType,
      toolType: logDetails.toolType,
      severity: logDetails.severity,
      userId: logDetails.userId,
      deviceId: logDetails.deviceId,
      timestamp: logDetails.timestamp,
      ingestDay: logDetails.ingestDay,
      message: logDetails.message,
      rawDetails: logDetails.details,
    };
  }

  const formattedJson = JSON.stringify(detailsData, null, 2);

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Section Title */}
      <div className="w-full text-ods-text-secondary text-h5">Details</div>

      {/* Details Card */}
      <div className="w-full rounded-[6px] border border-ods-border bg-ods-card">
        <div className="p-4 md:p-6">
          <div className="w-full overflow-x-auto">
            <pre className="min-w-0 whitespace-pre-wrap break-words text-ods-text-primary text-code">
              {formattedJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
