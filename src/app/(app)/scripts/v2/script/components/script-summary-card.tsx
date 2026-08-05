'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { scriptV2ShellLabel } from '../../shared/utils/shell-types';

interface ScriptSummaryCardProps {
  name: string;
  description?: string | null;
  /** Lowercase shell id (e.g. 'bash'). */
  shellId: string;
  /** Platform ids (e.g. ['windows', 'darwin']). */
  platforms: string[];
  timeoutSeconds?: number | null;
  /** Show the Timeout cell. Off on the run page, where the timeout is editable below. */
  showTimeout?: boolean;
  /** Author name ("Added by"). Pass `undefined` to omit the stat entirely. */
  author?: string | null;
}

/** Number of equal-width columns the metadata strip is laid out on. */
const META_COLUMNS = 4;

/**
 * Single source for the metadata-strip stat labels — the loaded card's `stats`
 * array is built from these, and the skeleton keys off the same map, so the two
 * can never disagree about which cells the strip has.
 */
const STAT_LABELS = {
  shell: 'Shell Type',
  platforms: 'Supported Platforms',
  timeout: 'Timeout (seconds)',
  author: 'Added by',
} as const;

/** Metadata-strip cell id — the skeleton takes these to pick its cell set. */
export type ScriptSummaryStat = keyof typeof STAT_LABELS;

/** Shared cell wrapper of the metadata strip — used by the loaded card AND the skeleton so they never drift. */
function MetaCell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-[1_0_0] min-w-[140px] flex-col justify-center gap-[var(--spacing-system-xxs)]">
      {children}
    </div>
  );
}

/** Trailing spacer that keeps cells on the {@link META_COLUMNS} grid when there are fewer stats. */
function MetaSpacer({ count }: { count: number }) {
  if (count >= META_COLUMNS) return null;
  return <div aria-hidden className="min-w-px" style={{ flex: `${META_COLUMNS - count} 1 0%` }} />;
}

/** A value-over-label cell in the metadata strip. */
function MetaStat({ value, label }: { value: string; label: string }) {
  return (
    <MetaCell>
      <TruncateText variant="h4">{value}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {label}
      </TruncateText>
    </MetaCell>
  );
}

function shellLabel(shellId: string): string {
  return scriptV2ShellLabel(shellId);
}

/**
 * Summary card shown on the script details and run pages: the name + description
 * header, then a metadata strip (shell type, platforms, and — on details —
 * timeout). The strip is laid out on a 4-column grid; a trailing spacer keeps
 * the cells aligned when there are fewer than 4.
 */
export function ScriptSummaryCard({
  name,
  description,
  shellId,
  platforms,
  timeoutSeconds,
  showTimeout = true,
  author,
}: ScriptSummaryCardProps) {
  const platformsText = platforms.map(getOSLabel).join(', ') || '—';

  const stats = [
    { label: STAT_LABELS.shell, value: shellLabel(shellId) },
    { label: STAT_LABELS.platforms, value: platformsText },
    ...(showTimeout ? [{ label: STAT_LABELS.timeout, value: String(timeoutSeconds ?? '—') }] : []),
    ...(author !== undefined ? [{ label: STAT_LABELS.author, value: author || '—' }] : []),
  ];

  return (
    <div className="bg-ods-card border border-ods-border rounded-[8px] overflow-hidden">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <TruncateText variant="h4">{name}</TruncateText>
        {description && (
          <TruncateText variant="h6" tone="secondary">
            {description}
          </TruncateText>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        {stats.map(stat => (
          <MetaStat key={stat.label} value={stat.value} label={stat.label} />
        ))}
        <MetaSpacer count={stats.length} />
      </div>
    </div>
  );
}

/** Stats the run page shows (`showTimeout` off, author on) — shared with its skeleton call sites. */
export const RUN_SUMMARY_STATS: readonly ScriptSummaryStat[] = ['shell', 'platforms', 'author'];

/** Default skeleton stats — the details-page set (`showTimeout` on, author shown). */
const DEFAULT_SKELETON_STATS: readonly ScriptSummaryStat[] = ['shell', 'platforms', 'timeout', 'author'];

/** Label-bar width per stat, sized to its real `text-h6` label so the strip keeps its rhythm. */
const STAT_LABEL_WIDTHS: Record<ScriptSummaryStat, string> = {
  shell: 'w-20',
  platforms: 'w-32',
  timeout: 'w-28',
  author: 'w-16',
};

/**
 * Skeleton for {@link ScriptSummaryCard}: the name header followed by the
 * metadata strip. Both lines of every stat cell are bars — the value on the
 * loaded card's `text-h4` line height (`h-6`), the label on its `text-h6` one
 * (`h-5`), so nothing jumps when the record lands. Pass the same stat set the
 * loaded card will show (default: the details-page 4). Mirrors the real card's
 * trailing spacer so widths line up.
 *
 * The DESCRIPTION line is deliberately absent: the loaded card drops it when the
 * script has none, so a bar there would promise a row that collapses on arrival.
 * The stat cells stay — the card renders all four whatever the record says,
 * writing "—" where it has no answer.
 */
export function ScriptSummaryCardSkeleton({
  stats = DEFAULT_SKELETON_STATS,
}: {
  stats?: readonly ScriptSummaryStat[];
}) {
  return (
    <div className="bg-ods-card border border-ods-border rounded-[8px] overflow-hidden">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        {stats.map(stat => (
          <MetaCell key={stat}>
            <Skeleton className="h-6 w-28" />
            <Skeleton className={`h-5 max-w-full ${STAT_LABEL_WIDTHS[stat]}`} />
          </MetaCell>
        ))}
        <MetaSpacer count={stats.length} />
      </div>
    </div>
  );
}
