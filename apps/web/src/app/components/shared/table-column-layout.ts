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
   *
   * It also keeps the header cell alive below `lg` (see `alwaysShowHeader`
   * below): `DataTable.Header` only does that on its own for columns with a
   * `meta.filter`, and the calendar is not one. Without the opt-in the control
   * vanishes between `md` and `lg` — exactly the window where the toolbar's
   * mobile filter button (`md:hidden`) is gone too, leaving no way at all to
   * reach the date filter.
   */
  dateFilterable?: boolean;
}

/**
 * There is deliberately NO way here to keep a column's header at full width
 * below `lg`.
 *
 * The core drops every header cell there except the ones a user can act on, and
 * packs the survivors left beside their controls — its tablet header is a filter
 * toolbar, not a row of labels. One table (Invoices History) used to opt out of
 * that with a `tabletHeaderWidth` string of literal `max-lg:[&&&]:…` classes,
 * outranking the core's own `[&&]` rule on specificity. It was the only use in
 * the app, and it bought a tablet where five columns still fought over ~760px.
 *
 * The way to be narrow is `hideAt`, which every other table already uses: shed
 * columns on the way down and let the header become the toolbar. If a column
 * genuinely needs a header class, pass it through `liveColumnMeta`'s `extra` as
 * `headerClassName` — a one-column concern does not belong in the layout shared
 * with the skeleton.
 *
 * The `meta` fields below are the ones a live column and its skeleton must agree
 * on — nothing more.
 */
interface SharedColumnMeta {
  width: string;
  hideAt?: TableBreakpoint;
  align?: 'right';
  sortable?: boolean;
  alwaysShowHeader?: boolean;
}

function sharedMeta(column: TableSkeletonColumn): SharedColumnMeta {
  return {
    width: column.width,
    hideAt: column.hideAt,
    align: column.align,
    sortable: column.sortable,
    // A date-filtered header is a control the user can act on, so it earns its
    // space below `lg` the same way the funnels do — the table keeps those on
    // its own, but knows nothing about the calendar. Nothing else opts in: see
    // the note above `SharedColumnMeta` for why wanting LABELS there is not a
    // reason.
    alwaysShowHeader: column.dateFilterable,
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
