/** The one no-op callback, for a control rendered inert (a loading form, a read-only view). */
export const noop = () => {};

/** A list's infinite scroll: whether there is a next page, whether it is being read, and how to ask for it. */
export interface InfiniteScroll {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/** The infinite scroll of a list whose rows have not answered yet: nothing to load on. */
export const NO_NEXT_PAGE: InfiniteScroll = { hasNextPage: false, isFetchingNextPage: false, onLoadMore: noop };
