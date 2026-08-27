import {
  type ColumnDef,
  multiSelectFilterFn as coreMultiSelectFilterFn,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * `filterFn` accepted by a `ColumnDef` of ANY row type.
 *
 * Core types its `multiSelectFilterFn` as `FilterFn<unknown>` (since 0.0.572), and that
 * fits no concrete column: `TData` sits in a contravariant position on the filter
 * (`autoRemove(value, column?: Column<TData>)`), so `FilterFn<unknown>` is not a supertype
 * of `FilterFn<UiLogEntry>` — `tsc` rejects it on every typed table. `FilterFn` itself is
 * not re-exported by the lib and `@tanstack/react-table` is not a direct dependency here,
 * hence the detour through `ColumnDef`.
 */
type AnyColumnFilterFn = ColumnDef<any>['filterFn'];

/**
 * Core's multi-select `filterFn`, re-typed so typed `ColumnDef<T>[]` accept it. The
 * predicate only reads the cell value, so it is row-type agnostic in fact — the widening
 * costs no real type safety, and keeps the cast in one place instead of ~15 columns.
 */
export const multiSelectFilterFn: AnyColumnFilterFn = coreMultiSelectFilterFn;
