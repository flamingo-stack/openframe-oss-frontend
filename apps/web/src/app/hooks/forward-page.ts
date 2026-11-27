import type { CursorPagerVariables } from '@flamingo-stack/openframe-frontend-core/hooks';

/**
 * The page variables of a list that pages FORWARD only (no `serverPrev`: its query declares `first: Int!` and
 * `after`, never `last` / `before`). The pager never reads such a list backward, so `first` is always set; the
 * fallback only satisfies the type.
 */
export function forwardPage(page: CursorPagerVariables, pageSize: number): { first: number; after: string | null } {
  return { first: page.first ?? pageSize, after: page.after };
}
