/**
 * Column layout metadata — the single source of truth shared by a live
 * `DataTable` and every skeleton that stands in for it.
 *
 * Why this module is deliberately data-only (no JSX, no `'use client'`, no
 * imports at all): a skeleton must not import the page's real table just to learn
 * the column widths — the table drags its Relay artifacts, mutations and cell
 * renderers along with it. Declaring the layout on its own lets the live table
 * and every skeleton standing in for it read the SAME array while only the live
 * table pays for the heavy parts.
 *
 * Every field here is layout-affecting: omit one on either side and the loading
 * table lays out differently from the loaded one, which is the shift these
 * declarations exist to prevent. Two are easy to miss:
 * - `filterable` is not cosmetic. `DataTable.Header` keeps a filterable
 *   column's header rendered below `lg` (its `keepOnTablet` rule) and skips the
 *   `hideAt` classes for it, so a skeleton that omits the flag silently drops
 *   header cells the loaded table shows.
 * - `sortable` makes the real header render a sort icon beside its label, so a
 *   skeleton without it centers the label differently.
 */
/**
 * The core table's own `hideAt` breakpoints, restated rather than imported —
 * this module stays import-free (see above), and a type import would be the
 * first crack in that.
 */
export type TableBreakpoint = 'md' | 'lg' | 'xl' | '2xl';

export interface TableSkeletonColumn {
  id: string;
  /** Real column header text — rendered verbatim, it isn't query-dependent. */
  header?: string;
  /** The real column's `meta.width` class. */
  width: string;
  hideAt?: TableBreakpoint;
  align?: 'right';
  /** Real column declares `meta.sortable` — its header renders a sort icon. */
  sortable?: boolean;
  /** Real column renders a filter dropdown, so its header survives below `lg`. */
  filterable?: boolean;
  /**
   * Real column's header hosts a `DateColumnHeader` (calendar popover). Like
   * `filterable`, this is layout-affecting rather than cosmetic: the icon sits
   * beside the label, so a skeleton without it draws a bare label that shifts
   * the moment the rows arrive. The skeleton renders the same header inert.
   */
  dateFilterable?: boolean;
}

/** The `meta` fields a live column and its skeleton must agree on. */
interface SharedColumnMeta {
  width: string;
  hideAt?: TableBreakpoint;
  align?: 'right';
  sortable?: boolean;
}

function sharedMeta(column: TableSkeletonColumn): SharedColumnMeta {
  return {
    width: column.width,
    hideAt: column.hideAt,
    align: column.align,
    sortable: column.sortable,
  };
}

/** Shared reference so a skeleton's meta stays referentially stable across renders. */
const NO_FILTER_OPTIONS: never[] = [];

/**
 * `meta` for a column inside a SKELETON table.
 *
 * A filterable column declares its filter as PENDING: no options, and the flag
 * that says they are still coming. That is what keeps the funnel drawn (inert)
 * instead of appearing with the data and pushing every label sideways — an empty
 * filter without the flag means "there is nothing to filter by", and the table
 * hides the funnel for it. It used to say `alwaysShowHeader`, which reproduced
 * the tablet visibility but drew a bare label.
 */
export function skeletonColumnMeta(
  column: TableSkeletonColumn,
): SharedColumnMeta & { filter?: { options: never[]; pending: true } } {
  return {
    ...sharedMeta(column),
    filter: column.filterable ? { options: NO_FILTER_OPTIONS, pending: true } : undefined,
  };
}

/**
 * `meta` for a LIVE column def: the shared layout plus that column's own extras
 * (`filter`, `cellClassName`, …). The layout wins on the shared fields on
 * purpose — passing a `width` through `extra` would reintroduce a second
 * declaration site for the very thing this module centralizes.
 *
 * `const T` so string literals inside `extra` survive inference: without it a
 * `placement: 'bottom-end'` widens to `string` and no longer satisfies the
 * table's `ColumnMeta`, which would push an `as const` onto every call site.
 */
export function liveColumnMeta<const T extends object>(column: TableSkeletonColumn, extra?: T): T & SharedColumnMeta {
  return { ...(extra as T), ...sharedMeta(column) };
}
