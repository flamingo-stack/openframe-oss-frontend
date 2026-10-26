'use client';

import { OSTypeBadgeGroup } from '@flamingo-stack/openframe-frontend-core/components';
import { isDeviceLocalTime } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { InfoCell } from '@/app/components/shared/info-cell';
import type { ScheduleTimeReference } from '@/generated/schema-enums';
import { ScriptScheduleTrigger } from '@/generated/schema-enums';
import { DEVICE_LOCAL_TIME_NOTE } from '../utils/schedule-timing';

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
  /**
   * Which clock `time` is on. A DEVICE_LOCAL schedule stores a wall clock each
   * device reads on its OWN timezone, so the value here is not the viewer's —
   * and nothing about "6:00 PM" says so. The cell's label carries the reading;
   * the value stays the digits that were picked, unconverted.
   */
  timeReference?: ScheduleTimeReference | string | null;
}

/** One value/label cell, 80px tall from `md` up — the row height the design fixes. The run's own bar shares it. */
const INFO_BAR_CELL_CLASS =
  'px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] content-md:py-0 content-md:h-[80px]';

/** A cell's classes on an info bar (the schedule's, and the run's, which matches it). */
export function infoBarCell(className?: string): string {
  return cn(INFO_BAR_CELL_CLASS, className);
}

/** The bar's card frame (the schedule's, and the run's). */
export const INFO_BAR_FRAME_CLASS =
  'flex w-full flex-col gap-0 overflow-clip rounded-[6px] border border-ods-border bg-ods-card';

/** A top-row cell stacked over another on a phone (two columns), divided from it. */
export const DIVIDED_CELL_CLASS = 'border-b border-ods-border content-md:border-b-0';

/** The platform icons' size (the group draws one icon box of it while loading). */
const PLATFORM_ICON_CLASS = 'w-5 h-5';

/**
 * The schedule's info bar. In a loading scope it draws itself: the name row when the page shows one (`name` given,
 * `''` while loading), the timing row, and the trailing row when the page passes its values (`''` while loading),
 * every value a bar and every label real.
 */
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
  timeReference,
}: ScheduleInfoBarFromDataProps) {
  const loading = useLoadingScope();
  // While loading the timing row draws the timed form (Date, Time, Repeat, Platform): a schedule fires on a clock
  // unless it was set to run on Device Online, the rare case, which loads into its two cells instead.
  const isEventDriven = !loading && trigger === ScriptScheduleTrigger.DEVICE_ONLINE;
  const timeLabel = !loading && isDeviceLocalTime(timeReference) ? `Time (${DEVICE_LOCAL_TIME_NOTE})` : 'Time';
  // While loading a row is drawn when the page passes its values (as `''`); once loaded, when they are set.
  const shows = (value: string | undefined) => (loading ? value !== undefined : !!value);
  const showName = shows(name);
  const showOffline = shows(ifDeviceOffline);
  const showAddedBy = shows(addedBy);
  const cell = infoBarCell;
  // Switches itself: in the loading scope one platform icon's box, at the size the icons are drawn.
  const platformIcons = <OSTypeBadgeGroup osTypes={platforms} iconSize={PLATFORM_ICON_CLASS} />;

  return (
    <div className={INFO_BAR_FRAME_CLASS}>
      {showName && (
        <div className="grid grid-cols-2 border-b border-ods-border">
          <InfoCell label="Schedule Name" value={name} className={cell()} />
          <InfoCell label="Note" value={note} skeletonWidth="w-24" className={cell()} />
        </div>
      )}
      <div
        className={cn(
          'grid grid-cols-2',
          isEventDriven ? 'content-md:grid-cols-2' : 'content-md:grid-cols-4',
          (showOffline || showAddedBy) && 'border-b border-ods-border',
        )}
      >
        {isEventDriven ? (
          <InfoCell label="Trigger" value="Device Online" className={cell()} />
        ) : (
          <>
            <InfoCell label="Date" value={date} skeletonWidth="w-24" className={cell(DIVIDED_CELL_CLASS)} />
            <InfoCell label={timeLabel} value={time} skeletonWidth="w-20" className={cell(DIVIDED_CELL_CLASS)} />
            <InfoCell label="Repeat" value={repeat} skeletonWidth="w-16" className={cell()} />
          </>
        )}
        <InfoCell label="Supported Platform" value={platformIcons} className={cell()} />
      </div>
      {/* A row of its own, not extra cells in the grid above — the design keeps
          the offline rule and authorship on a separate line from the timing,
          and they split it in half rather than inheriting the timing columns. */}
      {(showOffline || showAddedBy) && (
        <div className="grid grid-cols-1 content-md:grid-cols-2">
          {showOffline && (
            <InfoCell
              label="If Device Offline"
              value={ifDeviceOffline}
              skeletonWidth="w-28"
              className={cell(showAddedBy ? DIVIDED_CELL_CLASS : undefined)}
            />
          )}
          {showAddedBy && <InfoCell label="Added by" value={addedBy} skeletonWidth="w-24" className={cell()} />}
        </div>
      )}
    </div>
  );
}
