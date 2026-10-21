import { MediaSkeleton, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { isEmptyValue } from '@/lib/empty-value';
import { ValueText } from './value-text';

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
 * of the value's own line (`skeletonWidth`). A text value (a string or a number) is the shared `ValueText`. A plain
 * icon is replaced by an icon box while loading when the caller states its size (`iconSkeleton`), so a caller passes
 * only the REAL icon; an icon that switches itself, and a non-text value (`valueSkeleton`), are drawn in a loading
 * scope where they draw their own skeleton. Callers render the cell, never a copy of it.
 */
export interface InfoCellProps {
  /** The value — missing, blank or a formatter's empty mark draws the muted empty mark, so callers pass the raw field. */
  value: React.ReactNode;
  label: string;
  /** The REAL icon. When it does not switch itself, state `iconSkeleton` and the cell draws its box while loading. */
  icon?: React.ReactNode;
  /** The icon's box while loading (the lib's `MediaSkeleton.Icon` size and classes), for a plain icon. */
  iconSkeleton?: { size?: 'sm' | 'md' | 'lg'; className?: string };
  /** When set, the whole cell becomes an external link. */
  href?: string;
  className?: string;
  /** Draw the value as a bar (the read value is not here yet). A loading scope does the same. */
  loading?: boolean;
  /** The value bar's width while loading (a Tailwind width class). */
  skeletonWidth?: string;
  /** The value while it loads when it is not text: the REAL component (a status tag) with no data, drawn in a loading
   *  scope where it draws its own skeleton. */
  valueSkeleton?: React.ReactNode;
  /** The label is read too (a date under an identifier): while loading it is a text bar of this width. */
  labelSkeletonWidth?: string;
}

export function InfoCell({
  value,
  label,
  icon,
  iconSkeleton,
  href,
  className,
  loading,
  skeletonWidth = 'w-32',
  valueSkeleton,
  labelSkeletonWidth,
}: InfoCellProps) {
  const isLoading = useLoadingScope() || !!loading;
  /** The value when it is text (or missing): drawn by `ValueText`, like every text value. */
  const text = typeof value === 'string' || typeof value === 'number' || isEmptyValue(value) ? value : undefined;
  const isText = isLoading || text !== undefined || isEmptyValue(value);
  const content = (
    <div className={`flex min-w-0 flex-1 flex-col justify-center ${className ?? ''}`}>
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <LoadingWhen loading={isLoading}>
          {isLoading && iconSkeleton ? (
            <MediaSkeleton.Icon size={iconSkeleton.size} className={`shrink-0 ${iconSkeleton.className ?? ''}`} />
          ) : (
            icon && <span className="shrink-0">{icon}</span>
          )}
          {isLoading && valueSkeleton ? (
            <div className="min-w-0 flex-1">{valueSkeleton}</div>
          ) : isText ? (
            <div className="min-w-0 flex-1">
              <ValueText value={isLoading ? null : text} loading={isLoading} skeletonWidth={skeletonWidth} />
            </div>
          ) : (
            <div className="truncate text-ods-text-primary text-h4">{value}</div>
          )}
        </LoadingWhen>
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
