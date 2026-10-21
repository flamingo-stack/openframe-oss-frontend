import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { isEmptyValue } from '@/lib/empty-value';
import { EmptyValue } from './empty-value';

/**
 * InfoCell — reusable cell with primary value and secondary label, used in
 * detail/info card layouts. Maps to the ODS h3/h6 typography tokens.
 *
 * Examples:
 * - `<InfoCell value="workstation-23.acme.local" label="Hostname" />`
 * - `<InfoCell value={<>{date} <span className="...">{time}</span></>} label="Updated" />`
 * - `<InfoCell value="Laptop" label="Type" icon={<LaptopIcon />} />`
 * - `<InfoCell value="example.com" label="Website" href="https://example.com" />`
 *
 * Loading: in a loading scope (or with `loading`) the cell draws itself with its label real and its value a text bar
 * of the value's own line (`skeletonWidth`), the icon slot kept. Callers render the cell, never a copy of it.
 */
export interface InfoCellProps {
  /** The value — missing, blank or a formatter's empty mark draws the muted empty mark, so callers pass the raw field. */
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  /** When set, the whole cell becomes an external link. */
  href?: string;
  className?: string;
  /** Draw the value as a bar (the read value is not here yet). A loading scope does the same. */
  loading?: boolean;
  /** The value bar's width while loading (a Tailwind width class). */
  skeletonWidth?: string;
  /** The value's own loading shape when it is not text (a `TagSkeleton` for a status chip). */
  valueSkeleton?: React.ReactNode;
  /** The label is read too (a date under an identifier): while loading it is a text bar of this width. */
  labelSkeletonWidth?: string;
}

export function InfoCell({
  value,
  label,
  icon,
  href,
  className,
  loading,
  skeletonWidth = 'w-32',
  valueSkeleton,
  labelSkeletonWidth,
}: InfoCellProps) {
  const isLoading = useLoadingScope() || !!loading;
  const content = (
    <div className={`flex min-w-0 flex-1 flex-col justify-center ${className ?? ''}`}>
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {icon && <span className="shrink-0">{icon}</span>}
        {isLoading ? (
          <div className="min-w-0 flex-1">
            {valueSkeleton ?? <TextLineSkeleton type="h4" className={skeletonWidth} />}
          </div>
        ) : isEmptyValue(value) ? (
          <div className="min-w-0 flex-1 text-h4">
            <EmptyValue />
          </div>
        ) : typeof value === 'string' ? (
          <div className="min-w-0 flex-1">
            <TruncateText>{value}</TruncateText>
          </div>
        ) : (
          <div className="truncate text-ods-text-primary text-h4">{value}</div>
        )}
      </div>
      {isLoading && labelSkeletonWidth ? (
        <TextLineSkeleton type="h6" className={labelSkeletonWidth} />
      ) : (
        <p className="truncate text-ods-text-secondary text-h6">{label}</p>
      )}
    </div>
  );

  if (href && !isLoading) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center transition-opacity hover:opacity-80"
      >
        {content}
      </a>
    );
  }

  return content;
}
