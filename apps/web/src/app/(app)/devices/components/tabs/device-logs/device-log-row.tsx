'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Chevron01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { deviceLogRow_entry$key } from '@/__generated__/deviceLogRow_entry.graphql';
import { formatDate, formatLogTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import type { Instant } from '@/lib/graphql-scalars';
import { deviceLogLevelVariant } from '../../../utils/device-log-level';
import {
  DEVICE_LOG_DAY_HEADER,
  DEVICE_LOG_LEVEL_COLUMN,
  DEVICE_LOG_LINE,
  DEVICE_LOG_LIST_CLASS,
  DEVICE_LOG_TIME_COLUMN,
} from './device-log-layout';

const deviceLogRowFragment = graphql`
  fragment deviceLogRow_entry on DeviceLogEntry {
    timestamp
    agentTimestamp
    level
    message
    machineId
    hostname
    count
  }
`;

/** One line as the Log Details drawer shows it — a copy, so the drawer outlives the list that drew the row. */
export interface DeviceLogEntry {
  timestamp: Instant;
  agentTimestamp: Instant | null | undefined;
  level: string;
  message: string;
  /** The device the line came from; null on lines written before the agent reported one. */
  machineId: string | null | undefined;
  hostname: string | null | undefined;
  count: number | null | undefined;
}

interface DeviceLogRowProps {
  /** Null while the line is read: the row draws its loading form in the same box. */
  entry: deviceLogRow_entry$key | null;
  /**
   * The device the list belongs to: its own hostname is implied, so the line's is
   * shown only when it differs, and only from `content-md` up. Omitted on a list
   * spanning several devices, where the hostname is what tells the lines apart
   * and stays on at every width.
   */
  deviceHostname?: string;
  /** This line is the one open in the drawer. */
  selected: boolean;
  onSelect: (entry: DeviceLogEntry) => void;
}

/**
 * One log line: time · level · message. Opens the Log Details drawer, the same one the Logs page uses. Written once:
 * while the line is read (a loading scope, or no entry) the same row draws its time and message as bars and its level
 * as a tag-shaped bar; the hostname and count chips, which only some lines carry, come with the values.
 */
export function DeviceLogRow({ entry, deviceHostname, selected, onSelect }: DeviceLogRowProps) {
  const data = useFragment(deviceLogRowFragment, entry);
  const loading = useLoadingScope() || !data;
  const level = data ? data.level.trim().toUpperCase() : '';
  const multiDevice = deviceHostname === undefined;

  return (
    <li
      data-loading-item
      className={cn(
        'overflow-hidden rounded-md border transition-colors duration-200 motion-reduce:transition-none',
        selected ? 'border-ods-border bg-ods-card' : 'border-transparent',
      )}
    >
      <Button
        variant="transparent"
        size="wrap"
        font="regular"
        fullWidth
        aria-haspopup="dialog"
        onClick={() =>
          data &&
          onSelect({
            timestamp: data.timestamp,
            agentTimestamp: data.agentTimestamp,
            level,
            message: data.message,
            machineId: data.machineId,
            hostname: data.hostname,
            count: data.count,
          })
        }
        className={cn('justify-start rounded-none text-left focus-visible:ring-inset', DEVICE_LOG_LINE)}
      >
        {/* text-code: the column is sized in `ch`, which only matches the time's width in its font. */}
        <span className={cn(DEVICE_LOG_TIME_COLUMN, 'shrink-0 tabular-nums text-ods-text-secondary text-code')}>
          {loading ? <TextLineSkeleton type="code" as="span" className="w-full" /> : formatLogTime(data.timestamp)}
        </span>
        <span className={cn(DEVICE_LOG_LEVEL_COLUMN, 'flex shrink-0')}>
          <Tag
            as="span"
            label={loading ? '' : <span>{level}</span>}
            variant={loading ? undefined : deviceLogLevelVariant(level)}
            loading={loading}
            className="max-w-full"
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-ods-text-primary text-code">
          {loading ? <TextLineSkeleton type="code" as="span" className="w-full" /> : data.message}
        </span>
        {!loading && data.hostname && data.hostname !== deviceHostname && (
          <Tag
            as="span"
            variant="outline"
            data-loading-optional
            label={<span>{data.hostname}</span>}
            labelClassName="truncate"
            className={cn('shrink-0', multiDevice ? 'max-w-[12rem]' : 'hidden content-md:inline-flex')}
          />
        )}
        {!loading && data.count != null && data.count > 1 && (
          <Tag
            as="span"
            variant="outline"
            data-loading-optional
            label={<span>×{formatCount(data.count)}</span>}
            className="shrink-0"
          />
        )}
        <Chevron01RightIcon aria-hidden="true" className="shrink-0 text-ods-text-tertiary" />
      </Button>
    </li>
  );
}

/** A day's lines under its heading. The loading page draws the same group (with or without the heading). */
export function DeviceLogDayGroup({ date, children }: { date?: Date | null; children: ReactNode }) {
  return (
    <section className={DEVICE_LOG_LIST_CLASS}>
      {date !== undefined && <DeviceLogDayHeader date={date} />}
      <ul className={DEVICE_LOG_LIST_CLASS}>{children}</ul>
    </section>
  );
}

/** The heading each day's lines open with. In a loading scope the date is a bar in the same box. */
function DeviceLogDayHeader({ date }: { date: Date | null }) {
  const loading = useLoadingScope();
  return (
    <div className={DEVICE_LOG_DAY_HEADER}>
      {loading ? (
        <TextLineSkeleton type="h5" className="w-[8ch]" />
      ) : (
        <h3 className="uppercase text-ods-text-secondary text-h5">{formatDate(date)}</h3>
      )}
      <span aria-hidden="true" className="h-px flex-1 bg-ods-border" />
    </div>
  );
}
