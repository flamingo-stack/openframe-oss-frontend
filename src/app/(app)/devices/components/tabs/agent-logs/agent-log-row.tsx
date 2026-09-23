'use client';

import { Copy01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import type { UiDeviceLog } from '../../../types/device-log.types';
import { getDeviceLogLevelVariant } from '../../../utils/device-log-level';
import { formatDeviceLogTime } from '../../../utils/device-log-time';

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
      <dt className="w-[72px] shrink-0 text-ods-text-tertiary text-code">{label}</dt>
      <dd className="min-w-0 flex-1 text-ods-text-secondary text-code [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/**
 * One log line, spec §4 in the log-viewer shape: time · level · message,
 * monospace throughout, the message on one truncated line until the row is
 * opened. Opening wraps the message and adds the metadata (FE-6/FE-7).
 */
export function AgentLogRow({ line, deviceHostname, expanded, onToggle }: AgentLogRowProps) {
  const { copy } = useCopyToClipboard({ successDescription: 'Log line copied' });
  const foreignHostname = line.hostname && line.hostname !== deviceHostname ? line.hostname : null;
  const levelText = line.rawLevel.trim().toUpperCase() || line.level;

  return (
    <div className={cn('rounded-md', expanded && 'bg-ods-card')}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle(line.key)}
        className={cn(
          // `items-start` in BOTH states: switching it on expand moved the first
          // line 6px up, because the 20px text is centred against the 32px chip.
          // The `py-[6px]` below gives text the chip's height instead.
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
        <span className="w-[144px] shrink-0 truncate py-[6px] tabular-nums text-ods-text-secondary text-code md:w-[168px]">
          {formatDeviceLogTime(line.timestamp)}
        </span>
        {/* A slot, not the chip's own width: `INFO` and `ERROR` differ, and the
            message column must start at the same x on every row. */}
        <span className="flex w-[64px] shrink-0">
          {/* A node label, not a string: a string makes `Tag` mount a truncation
              observer and a body-portalled tooltip — per chip, per row. */}
          <Tag
            as="span"
            label={<span>{levelText}</span>}
            variant={getDeviceLogLevelVariant(line.level)}
            className="max-w-full"
          />
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 py-[6px] text-ods-text-primary text-code',
            expanded ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate',
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
      </button>
      {/* The 256px indent is 8 (row padding) + 168 (time) + 8 + 64 (chip) + 8, so
          the metadata starts under the message rather than beside it. */}
      {expanded && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-xs)] pb-[var(--spacing-system-xs)] md:pl-[256px]">
          {/* `received` repeats the row's time WITH its date, and `agent_ts` is
              the device's own clock — the two a reader opens a line to compare. */}
          <dl className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <MetaLine label="received" value={line.timestamp} />
            {line.agentTimestamp && <MetaLine label="agent_ts" value={line.agentTimestamp} />}
            {line.hostname && <MetaLine label="hostname" value={line.hostname} />}
          </dl>
          <div className="pt-[var(--spacing-system-xxs)]">
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
