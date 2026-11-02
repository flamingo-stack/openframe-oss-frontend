'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import type { ComponentProps } from 'react';

/**
 * A read line of text that is not here yet, as a bar of its own type step: a single figure line (a total, a catalog
 * floor), or a short sentence's lines. Silent (`status={false}`): it sits inside a part whose region already
 * announces the wait. One component, so no screen pairs a region and a bar by hand.
 */
export function LoadingLine({
  type,
  lines,
  as = 'div',
  className,
  regionClassName,
}: {
  /** The type step of the line (the figure's, when a figure sets the line's height). */
  type: ComponentProps<typeof TextLineSkeleton>['type'];
  /** How many lines the text typically runs to (1 by default). */
  lines?: number;
  /** `span` inside phrasing content (a button's label, a `<p>`). */
  as?: 'div' | 'span';
  /** The bar's classes (its typical width). */
  className?: string;
  /** The region's classes (`contents` to take no box of its own). */
  regionClassName?: string;
}) {
  return (
    <LoadingRegion as={as} status={false} className={regionClassName}>
      <TextLineSkeleton type={type} lines={lines} as={as} className={className} />
    </LoadingRegion>
  );
}
