'use client';

import { CheckIcon, Chevron01RightIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { agentLogRow_entry$key } from '@/__generated__/agentLogRow_entry.graphql';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatLogTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { deviceLogLevelVariant } from '../../../utils/device-log-level';
import { AGENT_LOG_LEVEL_COLUMN, AGENT_LOG_LINE, AGENT_LOG_TIME_COLUMN } from './agent-log-layout';

const agentLogRowFragment = graphql`
  fragment agentLogRow_entry on DeviceLogEntry {
    timestamp
    agentTimestamp
    level
    message
    hostname
    count
  }
`;

interface AgentLogRowProps {
  entry: agentLogRow_entry$key;
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
export function AgentLogRow({ entry, deviceHostname }: AgentLogRowProps) {
  const data = useFragment(agentLogRowFragment, entry);
  const [expanded, setExpanded] = useState(false);
  const { copy, copied } = useCopyToClipboard({ successDescription: 'Log line copied' });

  const level = data.level.trim().toUpperCase();
  const time = formatLogTime(data.timestamp);

  return (
    <div className={cn('rounded-md border border-transparent', expanded && 'border-ods-border bg-ods-card')}>
      <Button
        variant="transparent"
        size="wrap"
        font="regular"
        fullWidth
        aria-expanded={expanded}
        onClick={() => setExpanded(open => !open)}
        className={cn('justify-start text-left', AGENT_LOG_LINE)}
      >
        <span className={cn(AGENT_LOG_TIME_COLUMN, 'shrink-0 tabular-nums text-ods-text-secondary text-code')}>
          {time}
        </span>
        <span className={cn(AGENT_LOG_LEVEL_COLUMN, 'flex shrink-0')}>
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
      {expanded && (
        <div className="flex flex-col gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)] pb-[var(--spacing-system-xs)]">
          <p className="whitespace-pre-wrap text-ods-text-primary text-code [overflow-wrap:anywhere]">{data.message}</p>
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
                copied ? <CheckIcon className="text-ods-success" /> : <Copy02Icon className="text-ods-text-secondary" />
              }
              onClick={() => {
                void copy(data.message);
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
