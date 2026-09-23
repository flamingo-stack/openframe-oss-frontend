'use client';

import { Chevron01RightIcon, Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import type { UiDeviceLog } from '../../../types/device-log.types';
import { getDeviceLogLevelVariant } from '../../../utils/device-log-level';
import { formatDeviceLogTime } from '../../../utils/device-log-time';
import {
  AGENT_LOG_LEVEL_COLUMN,
  AGENT_LOG_LINE_BOX,
  AGENT_LOG_MESSAGE_INDENT,
  AGENT_LOG_TIME_COLUMN,
} from './agent-log-columns';

interface AgentLogRowProps {
  line: UiDeviceLog;
  /** The device's own hostname; FE-6 shows the line's only when it differs. */
  deviceHostname: string;
  /** Owned by the list: a virtualized row unmounts, so it cannot hold its own. */
  expanded: boolean;
  onToggle: (key: string) => void;
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
export function AgentLogRow({ line, deviceHostname, expanded, onToggle }: AgentLogRowProps) {
  const { copy } = useCopyToClipboard({ successDescription: 'Log line copied' });
  const foreignHostname = line.hostname && line.hostname !== deviceHostname ? line.hostname : null;
  const levelText = line.rawLevel.trim().toUpperCase() || line.level;

  // The border is always there, only its colour changes: `border-box` would
  // otherwise pull the content in by 1px at the moment the row opens.
  return (
    <div className={cn('rounded-md border border-transparent', expanded && 'border-ods-border bg-ods-card')}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle(line.key)}
        className={cn(
          // `items-start` in BOTH states: switching it on expand moved the first
          // line up. The text padding below instead grows the line box to the
          // chip's 32px — 8px against a 16px line, 6px against the 20px one.
          'flex w-full items-start gap-[var(--spacing-system-xs)] rounded-md px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)] text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
          // An open row already carries the card background; stacking hover on
          // top of it reads as a stuck highlight.
          !expanded && 'hover:bg-ods-bg-hover',
        )}
      >
        {/* FE-4: monospace, tabular figures, fixed WIDTH — an unparseable instant
            passes through whole, and equal content alone would not keep the
            message column starting at the same x on every row. */}
        <span
          className={cn(
            AGENT_LOG_TIME_COLUMN,
            AGENT_LOG_LINE_BOX,
            'shrink-0 truncate tabular-nums text-ods-text-secondary text-code',
          )}
        >
          {formatDeviceLogTime(line.timestamp)}
        </span>
        {/* A slot, not the chip's own width: `INFO` and `ERROR` differ, and the
            message column must start at the same x on every row. */}
        <span className={cn('flex shrink-0', AGENT_LOG_LEVEL_COLUMN)}>
          {/* A node label, not a string: a string makes `Tag` mount a truncation
              observer and a body-portalled tooltip — per chip, per row. */}
          <Tag
            as="span"
            label={<span>{levelText}</span>}
            variant={getDeviceLogLevelVariant(line.level)}
            className="max-w-full"
          />
        </span>
        {/* Below `md` the line stays a truncated title even when open — the full
            text is appended underneath. On `md+` there is room, so it still
            unfolds in place. */}
        <span
          className={cn(
            AGENT_LOG_LINE_BOX,
            'min-w-0 flex-1 truncate text-ods-text-primary text-code',
            expanded && 'md:overflow-visible md:text-clip md:whitespace-pre-wrap md:[overflow-wrap:anywhere]',
          )}
        >
          {line.message}
        </span>
        {foreignHostname && (
          <Tag
            as="span"
            variant="outline"
            label={<span>{foreignHostname}</span>}
            className="hidden shrink-0 md:inline-flex"
          />
        )}
        {line.count !== null && (
          <Tag as="span" variant="outline" label={<span>×{line.count}</span>} className="shrink-0" />
        )}
        {/* Decorative: `aria-expanded` on the button already states the state.
            Boxed to the chip's height so it centres without a padding of its own. */}
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
          {/* Only below `md`, where the title above stays truncated: full width,
              because columns leave a log line a third of a phone screen. */}
          <div className="flex flex-col gap-[var(--spacing-system-xxs)] md:hidden">
            <span className="text-ods-text-secondary text-h5">Message</span>
            <p className="whitespace-pre-wrap text-ods-text-primary text-code [overflow-wrap:anywhere]">
              {line.message}
            </p>
          </div>
          <span aria-hidden="true" className="h-px bg-ods-border md:hidden" />
          {/* `received` repeats the row's time WITH its date, and `agent_ts` is
              the device's own clock — the two a reader opens a line to compare. */}
          <dl className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <MetaLine label="received" value={line.timestamp} />
            {line.agentTimestamp && <MetaLine label="agent_ts" value={line.agentTimestamp} />}
            {line.hostname && <MetaLine label="hostname" value={line.hostname} />}
          </dl>
          <div>
            <Button
              variant="outline"
              size="small"
              leftIcon={<Copy01Icon />}
              onClick={() => {
                void copy(line.message);
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
