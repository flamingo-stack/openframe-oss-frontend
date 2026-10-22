'use client';

import { scriptShellLabel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import { TitleLines } from '@/app/components/shared';
import { DETAIL_CELL_CLASS, DETAIL_CELL_GAP_CLASS } from '@/app/components/shared/detail-cell';
import { InfoCell } from '@/app/components/shared/info-cell';
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

/** Trailing spacer that keeps cells on the {@link META_COLUMNS} grid when there are fewer stats. */
function MetaSpacer({ count }: { count: number }) {
  if (count >= META_COLUMNS) return null;
  return <div aria-hidden className="min-w-px" style={{ flex: `${META_COLUMNS - count} 1 0%` }} />;
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
 * and `author` pick it), the labels real, the name, the description and the
 * values bars. The description line is always drawn: a script with none shows
 * the muted empty mark there.
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
      <TitleLines
        title={name}
        subline={description}
        titleSkeletonWidth="w-56"
        sublineSkeletonWidth="w-72"
        className="gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]"
      />
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        {stats.map(stat => (
          // A value-over-label cell: the shared InfoCell, its value a bar in a loading scope.
          <div key={stat.label} className={DETAIL_CELL_CLASS}>
            <InfoCell value={stat.value} label={stat.label} skeletonWidth="w-28" className={DETAIL_CELL_GAP_CLASS} />
          </div>
        ))}
        <MetaSpacer count={stats.length} />
      </div>
    </div>
  );
}
