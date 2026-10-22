'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { isEmptyValue } from '@/lib/empty-value';
import { EmptyValue } from './empty-value';

/**
 * A value's text in the cell's type (h4), or the muted empty mark when there is none. While the value is read
 * (`loading`, or a loading scope) it is a bar of that line, `skeletonWidth` wide (the typical value's width).
 */
export function ValueText({
  value,
  loading: loadingProp,
  skeletonWidth = 'w-32',
}: {
  value: string | number | null | undefined;
  loading?: boolean;
  /** The bar's width while loading (a Tailwind width class). */
  skeletonWidth?: string;
}) {
  const loading = useLoadingScope() || !!loadingProp;
  if (loading) return <TextLineSkeleton type="h4" as="span" className={cn('max-w-full', skeletonWidth)} />;
  if (isEmptyValue(value)) {
    return (
      <span className="text-h4">
        <EmptyValue />
      </span>
    );
  }
  return <TruncateText>{String(value)}</TruncateText>;
}
