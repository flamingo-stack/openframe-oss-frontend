import {
  CURSOR_PAGER_KEYS,
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';

const noop = () => {};

/** The footer of a list that fits on its first page: what a table test hands a paged table's `pager`. */
export const FIRST_PAGE_FOOTER: CursorPagerFooterProps = {
  hasNextPage: false,
  hasPreviousPage: false,
  isFirstPage: true,
  page: 1,
  startCursor: null,
  endCursor: null,
  rangeStart: 1,
  onNext: noop,
  onPrevious: noop,
  onFirst: noop,
};

/** The query variables of a first page. */
export function firstPageVariables(pageSize: number): CursorPagerVariables {
  return { first: pageSize, after: null, last: null, before: null };
}

/**
 * A pager on the first page, in place of `useCursorPager`: for tests of a table, not of paging (that is the lib's
 * `use-cursor-pager.test.ts`). It never moves and never calls the cursor stale.
 */
export function firstPagePager(pageSize: number): UseCursorPagerReturn {
  return {
    cursor: null,
    page: 1,
    backward: false,
    isFirstPage: true,
    rangeStart: 1,
    variables: firstPageVariables(pageSize),
    canGoBackInHistory: false,
    goNext: noop,
    goPrevious: noop,
    goFirst: noop,
    dropCursor: noop,
    footerProps: () => FIRST_PAGE_FOOTER,
    isStale: () => false,
    resetKeys: CURSOR_PAGER_KEYS,
  };
}

/** The props a table that pages through `usePagedTable` takes from its frame, on the first page. */
export function firstPageProps(pageSize: number, paramPrefix = '') {
  return { pager: firstPagePager(pageSize), pageVariables: firstPageVariables(pageSize), paramPrefix };
}
