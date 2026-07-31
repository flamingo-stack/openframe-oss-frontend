'use client';

import { OSTypeBadgeGroup } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';
import type { ScriptScheduleDetail } from '../../types/script-schedule.types';
import { formatScheduleDate, getRepeatLabel } from '../../types/script-schedule.types';

interface ScheduleInfoBarProps {
  schedule: ScriptScheduleDetail;
}

export function ScheduleInfoBar({ schedule }: ScheduleInfoBarProps) {
  const { date, time } = formatScheduleDate(schedule.run_time_date);
  const repeat = getRepeatLabel(schedule);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
      <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px] border-b md:border-b-0 border-ods-border">
        <TruncateText>{date}</TruncateText>
        <span className="text-h6 text-ods-text-secondary">Date</span>
      </div>
      <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px] border-b md:border-b-0 border-ods-border">
        <TruncateText>{time}</TruncateText>
        <span className="text-h6 text-ods-text-secondary">Time</span>
      </div>
      <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
        <TruncateText>{repeat}</TruncateText>
        <span className="text-h6 text-ods-text-secondary">Repeat</span>
      </div>
      <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
        <OSTypeBadgeGroup osTypes={schedule.task_supported_platforms} iconSize="w-5 h-5" />
        <span className="text-h6 text-ods-text-secondary">Supported Platform</span>
      </div>
    </div>
  );
}

interface ScheduleInfoBarFromDataProps {
  /**
   * Renders the "Schedule Name / Note" row. Omit it on pages that already carry
   * the name as their page title — the details page does, so its bar starts at
   * the timing row (design node 260:44649).
   */
  name?: string;
  note?: string;
  /** Renders the trailing "Added by" row. Omitted = no row. */
  addedBy?: string;
  date: string;
  time: string;
  repeat: string;
  platforms: string[];
  /**
   * The schedule's trigger (v2). `DEVICE_ONLINE` is event-driven and carries no
   * timing at all, so the bottom row collapses to "Trigger | Supported
   * Platform" instead of showing three empty Date/Time/Repeat cells. For
   * `DATE_TIME` (and when omitted) the date/time/repeat cells ARE the trigger.
   */
  trigger?: ScriptScheduleTrigger | string | null;
}

export function ScheduleInfoBarFromData({
  name,
  note,
  addedBy,
  date,
  time,
  repeat,
  platforms,
  trigger,
}: ScheduleInfoBarFromDataProps) {
  const isEventDriven = trigger === ScriptScheduleTrigger.DEVICE_ONLINE;

  return (
    <div className="flex flex-col gap-0 bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
      {name && (
        <div className="grid grid-cols-2 border-b border-ods-border">
          <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
            <TruncateText>{name}</TruncateText>
            <span className="text-h6 text-ods-text-secondary">Schedule Name</span>
          </div>
          <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
            <TruncateText>{note || '—'}</TruncateText>
            <span className="text-h6 text-ods-text-secondary">Note</span>
          </div>
        </div>
      )}
      <div
        className={`grid grid-cols-2 ${isEventDriven ? 'md:grid-cols-2' : 'md:grid-cols-4'} ${
          addedBy ? 'border-b border-ods-border' : ''
        }`}
      >
        {isEventDriven ? (
          <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
            <span className="text-h4 text-ods-text-primary truncate">Device Online</span>
            <span className="text-h6 text-ods-text-secondary">Trigger</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px] border-b md:border-b-0 border-ods-border">
              <TruncateText>{date}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Date</span>
            </div>
            <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px] border-b md:border-b-0 border-ods-border">
              <TruncateText>{time}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Time</span>
            </div>
            <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
              <TruncateText>{repeat}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Repeat</span>
            </div>
          </>
        )}
        <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
          <OSTypeBadgeGroup osTypes={platforms} iconSize="w-5 h-5" />
          <span className="text-h6 text-ods-text-secondary">Supported Platform</span>
        </div>
      </div>
      {/* Full-width row of its own, not a fifth cell in the grid above — the
          design keeps authorship on a separate line from the timing. */}
      {addedBy && (
        <div className="flex flex-col items-start justify-center min-w-0 px-4 py-3 md:py-0 md:h-[80px]">
          <TruncateText>{addedBy}</TruncateText>
          <span className="text-h6 text-ods-text-secondary">Added by</span>
        </div>
      )}
    </div>
  );
}
