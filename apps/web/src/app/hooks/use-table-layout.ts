'use client';

import type { FeatureFlagGate } from '@/lib/feature-flags';
import { useFeatureFlagGate } from './use-feature-flag';

/** The layout a screen's table draws: the lib's `DataTableLayout`. */
export type TableLayout = 'cards' | 'grid';

/**
 * A developer's switch for a local run against an environment whose flag is off: `NEXT_PUBLIC_DATA_TABLE_GRID=true`
 * with `next dev`. The server answers `false` for a flag it does not know, so an env default behind the server's
 * answer would never apply; this stands in for the answer instead. Development builds only: a build that ships drops
 * the branch, so no deployment and no client can turn the tables on past the server.
 */
const LOCAL_ON = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DATA_TABLE_GRID === 'true';

/**
 * Whether the app's tables draw the new grid table (`data-table-grid`). ONE flag for every screen: the screens move
 * to the grid in separate changes, and the flag turns them all at once.
 *
 * A gate, not a boolean: the flag picks which of two layouts a table draws, so a guess before the answer would draw
 * one table and replace it with the other. While it is `'loading'` render the table in a loading scope
 * (`<LoadingWhen loading={gate === 'loading'}>`) with `tableLayoutFor(gate)`.
 */
export function useTableGridGate(): FeatureFlagGate {
  const gate = useFeatureFlagGate('data-table-grid');
  return LOCAL_ON ? 'on' : gate;
}

/** The layout for a gate's answer. Not answered yet draws the card rows' loading state: the layout every screen has. */
export function tableLayoutFor(gate: FeatureFlagGate): TableLayout {
  return gate === 'on' ? 'grid' : 'cards';
}
