'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { EmptyValue } from './empty-value';

export interface TitleLinesProps {
  /** The record's name (h4, truncated). Unread while loading. */
  title: string;
  /** The secondary line under it (h6, secondary tone). Unread while loading. */
  subline?: string | null;
  /**
   * What an empty secondary line draws once loaded: `mark` (the default) the muted empty mark, so a line every record
   * carries is always there; `none` no line, for a line only some records have, which draws no bar while loading
   * either (reserving it would be a guess).
   */
  emptySubline?: 'mark' | 'none';
  /** The secondary line wraps (a description) instead of truncating to one line. */
  wrapSubline?: boolean;
  /** How many h6 lines a wrapping secondary line typically runs to: the bars drawn while loading (1 by default). */
  sublineLines?: number;
  /** Drawn beside the title once loaded (role tags). */
  titleAside?: ReactNode;
  /** The title bar's width while loading (a Tailwind width class). */
  titleSkeletonWidth?: string;
  /** The secondary line's bar width while loading (a Tailwind width class). */
  sublineSkeletonWidth?: string;
  /** Classes of the title's row (a fixed `min-h-8` when it carries tags). */
  titleClassName?: string;
  /** Classes of the frame (gap, padding, border). */
  className?: string;
  /** The read data is not here yet. A loading scope does the same. */
  loading?: boolean;
}

/**
 * A record's title over its secondary line (a script's name and description, a device's name and its address, a
 * user's name and email). It switches itself: in a loading scope (or with `loading`) the title and the line are bars
 * of their own type steps, `titleSkeletonWidth` / `sublineSkeletonWidth` wide; every other part is the same box.
 */
export function TitleLines({
  title,
  subline,
  emptySubline = 'mark',
  wrapSubline = false,
  sublineLines = 1,
  titleAside,
  titleSkeletonWidth = 'w-48',
  sublineSkeletonWidth = 'w-64',
  titleClassName,
  className,
  loading: loadingProp = false,
}: TitleLinesProps) {
  const loading = useLoadingScope() || loadingProp;
  const hasSubline = !!subline;
  const drawsSubline = loading ? emptySubline === 'mark' : hasSubline || emptySubline === 'mark';

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className={cn('flex min-w-0 items-center gap-2', titleClassName)}>
        {loading ? (
          <TextLineSkeleton type="h4" className={cn('max-w-full', titleSkeletonWidth)} />
        ) : (
          <>
            <div className="min-w-0">
              <TruncateText>{title}</TruncateText>
            </div>
            {titleAside}
          </>
        )}
      </div>
      {drawsSubline &&
        (loading ? (
          <TextLineSkeleton
            type="h6"
            lines={wrapSubline ? sublineLines : 1}
            className={cn('max-w-full', sublineSkeletonWidth)}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {!hasSubline ? (
              <span className="text-h6">
                <EmptyValue />
              </span>
            ) : wrapSubline ? (
              <p className="text-ods-text-secondary text-h6">{subline}</p>
            ) : (
              <div className="min-w-0">
                <TruncateText variant="h6" tone="secondary">
                  {subline}
                </TruncateText>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
