'use client';

import { CheckIcon, Chevron01RightIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { deviceLogRow_entry$key } from '@/__generated__/deviceLogRow_entry.graphql';
import { useCollapsePhase } from '@/app/hooks/use-collapse-phase';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatLogTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
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

interface DeviceLogRowProps {
  entry: deviceLogRow_entry$key;
  /** The device's own hostname; the line's is shown only when it differs. */
  deviceHostname: string;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-[var(--spacing-system-xs)]">
      <dt className="w-[72px] shrink-0 text-ods-text-secondary text-code">{label}</dt>
      <dd className="min-w-0 flex-1 text-ods-text-primary text-code [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/** One log line: time · level · message, opening to the full message, the raw instants, the hostname and Copy. */
export function DeviceLogRow({ entry, deviceHostname }: DeviceLogRowProps) {
  const data = useFragment(deviceLogRowFragment, entry);
  const { phase, toggle, collapsed } = useCollapsePhase();
  const expanded = phase === 'opening' || phase === 'open';
  const { copy, copied } = useCopyToClipboard({ successDescription: 'Log line copied' });

  const level = data.level.trim().toUpperCase();
  const time = formatLogTime(data.timestamp);

  return (
    // overflow-hidden: the header's hover fill takes the row's own corners, flush with the body when open.
    <li
      className={cn(
        'overflow-hidden rounded-md border border-transparent transition-colors duration-200 motion-reduce:transition-none',
        phase === 'open' && 'border-ods-border bg-ods-card',
      )}
    >
      <Button
        variant="transparent"
        size="wrap"
        font="regular"
        fullWidth
        aria-expanded={expanded}
        onClick={toggle}
        className={cn('justify-start rounded-none text-left focus-visible:ring-inset', DEVICE_LOG_LINE)}
      >
        <span className={cn(DEVICE_LOG_TIME_COLUMN, 'shrink-0 tabular-nums text-ods-text-secondary text-code')}>
          {time}
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
            className="hidden shrink-0 md:inline-flex"
          />
        )}
        {data.count != null && data.count > 1 && (
          <Tag as="span" variant="outline" label={<span>×{formatCount(data.count)}</span>} className="shrink-0" />
        )}
        <Chevron01RightIcon
          aria-hidden="true"
          className={cn(
            'shrink-0 text-ods-text-tertiary transition-transform motion-reduce:transition-none',
            expanded && 'rotate-90',
          )}
        />
      </Button>
      {phase !== null && (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            phase === 'open' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          onTransitionEnd={event => {
            if (event.target === event.currentTarget && phase === 'closing') collapsed();
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)] pb-[var(--spacing-system-xs)]">
              <p className="whitespace-pre-wrap text-ods-text-primary text-code [overflow-wrap:anywhere]">
                {data.message}
              </p>
              <dl className="flex flex-col gap-[var(--spacing-system-xxs)]">
                <MetaLine label="received" value={data.timestamp} />
                {data.agentTimestamp != null && <MetaLine label="agent_ts" value={data.agentTimestamp} />}
                {data.hostname && <MetaLine label="hostname" value={data.hostname} />}
              </dl>
              <div>
                <Button
                  variant="outline"
                  size="small"
                  leftIcon={
                    copied ? (
                      <CheckIcon className="text-ods-success" />
                    ) : (
                      <Copy02Icon className="text-ods-text-secondary" />
                    )
                  }
                  onClick={() => {
                    void copy(data.message);
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
