'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { scriptShellLabel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { ValueText } from '@/app/components/shared/value-text';
import { displayValue } from '@/lib/empty-value';

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

/** The metadata-strip stat labels: static copy, drawn for real while the card loads. */
const STAT_LABELS = {
  shell: 'Shell Type',
  platforms: 'Supported Platforms',
  timeout: 'Timeout (seconds)',
  author: 'Added by',
} as const;

/** Cell wrapper of the metadata strip. */
function MetaCell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-[140px] flex-[1_0_0] flex-col justify-center gap-[var(--spacing-system-xxs)]">
      {children}
    </div>
  );
}

/** Trailing spacer that keeps cells on the {@link META_COLUMNS} grid when there are fewer stats. */
function MetaSpacer({ count }: { count: number }) {
  if (count >= META_COLUMNS) return null;
  return <div aria-hidden className="min-w-px" style={{ flex: `${META_COLUMNS - count} 1 0%` }} />;
}

/** A value-over-label cell in the metadata strip; the value is a bar while loading, the label is real. */
function MetaStat({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return (
    <MetaCell>
      {loading ? <TextLineSkeleton type="h4" className="w-28" /> : <ValueText value={value} />}
      <TruncateText variant="h6" tone="secondary">
        {label}
      </TruncateText>
    </MetaCell>
  );
}

function shellLabel(shellId: string): string {
  return scriptShellLabel(shellId);
}

/**
 * Summary card shown on the script details and run pages: the name + description
 * header, then a metadata strip (shell type, platforms, and — on details —
 * timeout). The strip is laid out on a 4-column grid; a trailing spacer keeps
 * the cells aligned when there are fewer than 4.
 *
 * In a loading scope it draws itself: the same frame and stat set (`showTimeout`
 * and `author` pick it), the labels real, the name and values bars. The
 * DESCRIPTION line is left out while loading: the loaded card drops it when the
 * script has none, so a bar there would promise a row that collapses on arrival.
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
  const loading = useLoadingScope();
  const platformsText = loading ? '' : platforms.map(getOSLabel).join(', ');

  const stats = [
    { label: STAT_LABELS.shell, value: loading ? '' : shellLabel(shellId) },
    { label: STAT_LABELS.platforms, value: displayValue(platformsText) },
    ...(showTimeout ? [{ label: STAT_LABELS.timeout, value: displayValue(timeoutSeconds) }] : []),
    ...(author !== undefined ? [{ label: STAT_LABELS.author, value: displayValue(author) }] : []),
  ];

  return (
    <div className="overflow-hidden rounded-[8px] border border-ods-border bg-ods-card">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        {loading ? <TextLineSkeleton type="h4" className="w-56" /> : <TruncateText variant="h4">{name}</TruncateText>}
        {!loading && description && (
          <TruncateText variant="h6" tone="secondary">
            {description}
          </TruncateText>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        {stats.map(stat => (
          <MetaStat key={stat.label} value={stat.value} label={stat.label} loading={loading} />
        ))}
        <MetaSpacer count={stats.length} />
      </div>
    </div>
  );
}
