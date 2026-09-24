'use client';

import { Chevron01RightIcon, Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { agentLogRow_entry$key } from '@/__generated__/agentLogRow_entry.graphql';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { toRepeatCount } from '../../../utils/device-log-count';
import { getDeviceLogLevelVariant, normalizeDeviceLogLevel } from '../../../utils/device-log-level';
import { formatDeviceLogTime } from '../../../utils/device-log-time';
import {
  AGENT_LOG_LEVEL_COLUMN,
  AGENT_LOG_LINE_BOX,
  AGENT_LOG_MESSAGE_INDENT,
  AGENT_LOG_TIME_COLUMN,
} from './agent-log-columns';

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
  /** The device's own hostname; FE-6 shows the line's only when it differs. */
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

/**
 * One log line, spec §4 in the log-viewer shape: time · level · message,
 * monospace throughout, truncated until the row is opened. Opening unfolds the
 * message in place on `md+`, and appends it full width below on a phone.
 */
export function AgentLogRow({ entry, deviceHostname }: AgentLogRowProps) {
  const data = useFragment(agentLogRowFragment, entry);
  const [expanded, setExpanded] = useState(false);
  const { copy } = useCopyToClipboard({ successDescription: 'Log line copied' });

  // `Instant` is an unmapped scalar (`any` in the artifact); the wire form is a string.
  const timestamp = String(data.timestamp);
  const agentTimestamp = data.agentTimestamp == null ? null : String(data.agentTimestamp);
  const level = normalizeDeviceLogLevel(data.level);
  const levelText = data.level.trim().toUpperCase() || level;
  const count = toRepeatCount(data.count);
  const foreignHostname = data.hostname && data.hostname !== deviceHostname ? data.hostname : null;

  // The border is always there, only its colour changes: `border-box` would
  // otherwise pull the content in by 1px at the moment the row opens.
  return (
    <div className={cn('rounded-md border border-transparent', expanded && 'border-ods-border bg-ods-card')}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(open => !open)}
        className={cn(
          // `items-start` in BOTH states: switching it on expand moved the first
          // line up. The line box below grows the text to the chip's 32px instead.
          'flex w-full items-start gap-[var(--spacing-system-xs)] rounded-md px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)] text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
          // An open row already carries the card background; stacking hover on
          // top of it reads as a stuck highlight.
          !expanded && 'hover:bg-ods-bg-hover',
        )}
      >
        {/* Fixed WIDTH, not merely equal content: an unparseable instant passes
            through whole, and the message must start at the same x on every row. */}
        <span
          className={cn(
            AGENT_LOG_TIME_COLUMN,
            AGENT_LOG_LINE_BOX,
            'shrink-0 truncate tabular-nums text-ods-text-secondary text-code',
          )}
        >
          {formatDeviceLogTime(timestamp)}
        </span>
        {/* A slot, not the chip's own width: `INFO` and `ERROR` differ. */}
        <span className={cn('flex shrink-0', AGENT_LOG_LEVEL_COLUMN)}>
          {/* A node label, not a string: a string makes `Tag` mount a truncation
              observer and a body-portalled tooltip — per chip, per row. */}
          <Tag
            as="span"
            label={<span>{levelText}</span>}
            variant={getDeviceLogLevelVariant(level)}
            className="max-w-full"
          />
        </span>
        {/* Below `md` the line stays a truncated title even when open — the full
            text is appended underneath. On `md+` it unfolds in place. */}
        <span
          className={cn(
            AGENT_LOG_LINE_BOX,
            'min-w-0 flex-1 truncate text-ods-text-primary text-code',
            expanded && 'md:overflow-visible md:text-clip md:whitespace-pre-wrap md:[overflow-wrap:anywhere]',
          )}
        >
          {data.message}
        </span>
        {foreignHostname && (
          <Tag
            as="span"
            variant="outline"
            label={<span>{foreignHostname}</span>}
            className="hidden shrink-0 md:inline-flex"
          />
        )}
        {count !== null && <Tag as="span" variant="outline" label={<span>×{count}</span>} className="shrink-0" />}
        {/* Decorative: `aria-expanded` on the button already states the state. */}
        <span aria-hidden="true" className="flex h-8 shrink-0 items-center">
          <Chevron01RightIcon
            className={cn('h-4 w-4 text-ods-text-tertiary transition-transform', expanded && 'rotate-90')}
          />
        </span>
      </button>
      {expanded && (
        <div
          className={cn(
            'flex flex-col gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)] pb-[var(--spacing-system-xs)] md:gap-[var(--spacing-system-xxs)]',
            AGENT_LOG_MESSAGE_INDENT,
          )}
        >
          {/* Only below `md`, where the title above stays truncated. */}
          <div className="flex flex-col gap-[var(--spacing-system-xxs)] md:hidden">
            <span className="text-ods-text-secondary text-h5">Message</span>
            <p className="whitespace-pre-wrap text-ods-text-primary text-code [overflow-wrap:anywhere]">
              {data.message}
            </p>
          </div>
          <span aria-hidden="true" className="h-px bg-ods-border md:hidden" />
          {/* The raw instants: `received` is the row's time with its date and
              zone, `agent_ts` the device's own clock — the two a reader compares. */}
          <dl className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <MetaLine label="received" value={timestamp} />
            {agentTimestamp && <MetaLine label="agent_ts" value={agentTimestamp} />}
            {data.hostname && <MetaLine label="hostname" value={data.hostname} />}
          </dl>
          <div>
            <Button
              variant="outline"
              size="small"
              leftIcon={<Copy01Icon />}
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
