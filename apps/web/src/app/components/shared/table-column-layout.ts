/**
 * Column layout metadata — the single source of truth for a `DataTable`'s columns.
 *
 * A table's loading state is the live table itself, rendered with no rows in a loading scope, so the layout
 * is declared once here and read by the live column defs through `liveColumnMeta`. The module stays
 * data-only (no JSX, no `'use client'`, no imports at all) so a column layout can be shared without
 * dragging a table's Relay artifacts, mutations and cell renderers along with it.
 *
 * Every field here is layout-affecting: `sortable` makes the header draw a sort icon beside its label, and
 * `dateFilterable` keeps a calendar header cell alive below `lg`.
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
  /**
   * Real column renders a filter dropdown. Declarative only: the live column states its filter through
   * `liveColumnMeta`'s `extra`, which is what keeps its header below `lg`.
   */
  filterable?: boolean;
  /**
   * Real column's header hosts a `DateColumnHeader` (calendar popover). Like
   * `filterable`, this is layout-affecting rather than cosmetic: the icon sits
   * beside the label, so a header without it draws a bare label.
   *
   * It also keeps the header cell alive below `lg` (see `alwaysShowHeader`
   * below): `DataTable.Header` only does that on its own for columns with a
   * `meta.filter`, and the calendar is not one. Without the opt-in the control
   * vanishes between `md` and `lg` — exactly the window where the toolbar's
   * mobile filter button (`content-md:hidden`) is gone too, leaving no way at all to
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
 * that with a `tabletHeaderWidth` string of literal `content-max-lg:[&&&]:…` classes,
 * outranking the core's own `[&&]` rule on specificity. It was the only use in
 * the app, and it bought a tablet where five columns still fought over ~760px.
 *
 * The way to be narrow is `hideAt`, which every other table already uses: shed
 * columns on the way down and let the header become the toolbar. If a column
 * genuinely needs a header class, pass it through `liveColumnMeta`'s `extra` as
 * `headerClassName` — a one-column concern does not belong in the shared layout.
 *
 * The `meta` fields below are the shared layout fields — nothing more.
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
