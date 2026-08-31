'use client';

import { OSTypeBadgeGroup } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';

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
  /**
   * What happens to a device that is offline when the schedule fires, already
   * worded (`offlineBehaviorToLabel`). Shares the trailing row with "Added by"
   * — design node 793:64147. Omitted for a trigger the setting cannot apply to.
   */
  ifDeviceOffline?: string;
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

/** One value/label cell, 80px tall from `md` up — the row height the design fixes. */
const CELL_CLASS =
  'flex flex-col items-start justify-center min-w-0 px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] md:py-0 md:h-[80px]';

export function ScheduleInfoBarFromData({
  name,
  note,
  addedBy,
  ifDeviceOffline,
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
          <div className={CELL_CLASS}>
            <TruncateText>{name}</TruncateText>
            <span className="text-h6 text-ods-text-secondary">Schedule Name</span>
          </div>
          <div className={CELL_CLASS}>
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
          <div className={CELL_CLASS}>
            <span className="text-h4 text-ods-text-primary truncate">Device Online</span>
            <span className="text-h6 text-ods-text-secondary">Trigger</span>
          </div>
        ) : (
          <>
            <div className={`${CELL_CLASS} border-b md:border-b-0 border-ods-border`}>
              <TruncateText>{date}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Date</span>
            </div>
            <div className={`${CELL_CLASS} border-b md:border-b-0 border-ods-border`}>
              <TruncateText>{time}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Time</span>
            </div>
            <div className={CELL_CLASS}>
              <TruncateText>{repeat}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Repeat</span>
            </div>
          </>
        )}
        <div className={CELL_CLASS}>
          <OSTypeBadgeGroup osTypes={platforms} iconSize="w-5 h-5" />
          <span className="text-h6 text-ods-text-secondary">Supported Platform</span>
        </div>
      </div>
      {/* A row of its own, not extra cells in the grid above — the design keeps
          the offline rule and authorship on a separate line from the timing,
          and they split it in half rather than inheriting the timing columns. */}
      {(ifDeviceOffline || addedBy) && (
        <div className="grid grid-cols-1 md:grid-cols-2">
          {ifDeviceOffline && (
            <div className={`${CELL_CLASS}${addedBy ? ' border-b md:border-b-0 border-ods-border' : ''}`}>
              <TruncateText>{ifDeviceOffline}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">If Device Offline</span>
            </div>
          )}
          {addedBy && (
            <div className={CELL_CLASS}>
              <TruncateText>{addedBy}</TruncateText>
              <span className="text-h6 text-ods-text-secondary">Added by</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
