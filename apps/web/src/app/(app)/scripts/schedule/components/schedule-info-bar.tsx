'use client';

import {
  OSTypeBadgeGroup,
  TextLineSkeleton,
  UnifiedSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components';
import { isDeviceLocalTime } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { ValueText } from '@/app/components/shared/value-text';
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

/** One value/label cell, 80px tall from `md` up — the row height the design fixes. */
const CELL_CLASS =
  'flex flex-col items-start justify-center min-w-0 px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] content-md:py-0 content-md:h-[80px]';

/** A top-row cell stacked over another on a phone (two columns), divided from it. */
const DIVIDED_CELL_CLASS = 'border-b border-ods-border content-md:border-b-0';

/** The platform icons' size, shared by the loaded icons and their loading placeholder. */
const PLATFORM_ICON_CLASS = 'w-5 h-5';

/**
 * One value-over-label cell. While loading, its value is `skeleton` (a text bar on the value's `text-h4` line by
 * default); the label is static copy and stays real.
 */
function InfoBarCell({
  label,
  loading,
  skeleton,
  skeletonWidth = 'w-24',
  className,
  children,
}: {
  label: string;
  loading: boolean;
  skeleton?: ReactNode;
  skeletonWidth?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(CELL_CLASS, className)}>
      {loading ? (skeleton ?? <TextLineSkeleton type="h4" className={cn('max-w-full', skeletonWidth)} />) : children}
      <span className="text-ods-text-secondary text-h6">{label}</span>
    </div>
  );
}

/**
 * The schedule's info bar. In a loading scope it draws itself: the name row when the page shows one (`name` given,
 * `''` while loading), the date-time timing row and the trailing row (every schedule has an author and an offline
 * behavior, so the loaded bar is two storeys tall in practice), every value a bar and every label real.
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
  const isEventDriven = !loading && trigger === ScriptScheduleTrigger.DEVICE_ONLINE;
  const timeLabel = !loading && isDeviceLocalTime(timeReference) ? `Time (${DEVICE_LOCAL_TIME_NOTE})` : 'Time';
  const showName = loading ? name !== undefined : !!name;
  const showOffline = loading || !!ifDeviceOffline;
  const showAddedBy = loading || !!addedBy;

  return (
    <div className="flex w-full flex-col gap-0 overflow-clip rounded-[6px] border border-ods-border bg-ods-card">
      {showName && (
        <div className="grid grid-cols-2 border-b border-ods-border">
          <InfoBarCell label="Schedule Name" loading={loading} skeletonWidth="w-32">
            <TruncateText>{name ?? ''}</TruncateText>
          </InfoBarCell>
          <InfoBarCell label="Note" loading={loading}>
            <ValueText value={note} />
          </InfoBarCell>
        </div>
      )}
      <div
        className={cn(
          'grid grid-cols-2',
          isEventDriven ? 'content-md:grid-cols-2' : 'content-md:grid-cols-4',
          showAddedBy && 'border-b border-ods-border',
        )}
      >
        {isEventDriven ? (
          <InfoBarCell label="Trigger" loading={false}>
            <span className="truncate text-ods-text-primary text-h4">Device Online</span>
          </InfoBarCell>
        ) : (
          <>
            <InfoBarCell label="Date" loading={loading} className={DIVIDED_CELL_CLASS}>
              <TruncateText>{date}</TruncateText>
            </InfoBarCell>
            <InfoBarCell label={timeLabel} loading={loading} skeletonWidth="w-20" className={DIVIDED_CELL_CLASS}>
              <TruncateText>{time}</TruncateText>
            </InfoBarCell>
            <InfoBarCell label="Repeat" loading={loading} skeletonWidth="w-16">
              <TruncateText>{repeat}</TruncateText>
            </InfoBarCell>
          </>
        )}
        <InfoBarCell
          label="Supported Platform"
          loading={loading}
          // One platform icon's box: the icons are drawn at this size once read.
          skeleton={<UnifiedSkeleton className={cn('rounded', PLATFORM_ICON_CLASS)} />}
        >
          <OSTypeBadgeGroup osTypes={platforms} iconSize={PLATFORM_ICON_CLASS} />
        </InfoBarCell>
      </div>
      {/* A row of its own, not extra cells in the grid above — the design keeps
          the offline rule and authorship on a separate line from the timing,
          and they split it in half rather than inheriting the timing columns. */}
      {(showOffline || showAddedBy) && (
        <div className="grid grid-cols-1 content-md:grid-cols-2">
          {showOffline && (
            <InfoBarCell
              label="If Device Offline"
              loading={loading}
              skeletonWidth="w-28"
              className={showAddedBy ? DIVIDED_CELL_CLASS : undefined}
            >
              <TruncateText>{ifDeviceOffline ?? ''}</TruncateText>
            </InfoBarCell>
          )}
          {showAddedBy && (
            <InfoBarCell label="Added by" loading={loading}>
              <TruncateText>{addedBy ?? ''}</TruncateText>
            </InfoBarCell>
          )}
        </div>
      )}
    </div>
  );
}
