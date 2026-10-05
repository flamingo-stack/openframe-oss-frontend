'use client';

import { Chevron01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { deviceLogRow_entry$key } from '@/__generated__/deviceLogRow_entry.graphql';
import { formatLogTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import type { Instant } from '@/lib/graphql-scalars';
import { deviceLogLevelVariant } from '../../../utils/device-log-level';
import { DEVICE_LOG_LEVEL_COLUMN, DEVICE_LOG_LINE, DEVICE_LOG_TIME_COLUMN } from './device-log-layout';

const deviceLogRowFragment = graphql`
  fragment deviceLogRow_entry on DeviceLogEntry {
    timestamp
    agentTimestamp
    level
    message
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
  hostname: string | null | undefined;
  count: number | null | undefined;
}

interface DeviceLogRowProps {
  entry: deviceLogRow_entry$key;
  /** The device's own hostname; the line's is shown only when it differs. */
  deviceHostname: string;
  /** This line is the one open in the drawer. */
  selected: boolean;
  onSelect: (entry: DeviceLogEntry) => void;
}

/** One log line: time · level · message. Opens the Log Details drawer, the same one the Logs page uses. */
export function DeviceLogRow({ entry, deviceHostname, selected, onSelect }: DeviceLogRowProps) {
  const data = useFragment(deviceLogRowFragment, entry);
  const level = data.level.trim().toUpperCase();

  return (
    <li
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
          onSelect({
            timestamp: data.timestamp,
            agentTimestamp: data.agentTimestamp,
            level,
            message: data.message,
            hostname: data.hostname,
            count: data.count,
          })
        }
        className={cn('justify-start rounded-none text-left focus-visible:ring-inset', DEVICE_LOG_LINE)}
      >
        <span className={cn(DEVICE_LOG_TIME_COLUMN, 'shrink-0 tabular-nums text-ods-text-secondary text-code')}>
          {formatLogTime(data.timestamp)}
        </span>
        <span className={cn(DEVICE_LOG_LEVEL_COLUMN, 'flex shrink-0')}>
          <Tag as="span" label={<span>{level}</span>} variant={deviceLogLevelVariant(level)} className="max-w-full" />
        </span>
        <span className="min-w-0 flex-1 truncate text-ods-text-primary text-code">{data.message}</span>
        {data.hostname && data.hostname !== deviceHostname && (
          <Tag
            as="span"
            variant="outline"
            label={<span>{data.hostname}</span>}
            className="hidden shrink-0 content-md:inline-flex"
          />
        )}
        {data.count != null && data.count > 1 && (
          <Tag as="span" variant="outline" label={<span>×{formatCount(data.count)}</span>} className="shrink-0" />
        )}
        <Chevron01RightIcon aria-hidden="true" className="shrink-0 text-ods-text-tertiary" />
      </Button>
    </li>
  );
}
