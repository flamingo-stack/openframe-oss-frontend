import {
  type ColumnDef,
  multiSelectFilterFn as coreMultiSelectFilterFn,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * Core's multi-select `filterFn`, widened so typed `ColumnDef<T>[]` accept it.
 *
 * Core types it `FilterFn<unknown>` (since 0.0.572), which fits no concrete column:
 * `TData` is contravariant on the filter, so `FilterFn<unknown>` is not a supertype of
 * `FilterFn<UiLogEntry>`. The predicate only reads the cell value, so widening costs no
 * real safety — and keeps the cast in one place instead of ~15 columns. The detour
 * through `ColumnDef` is because `FilterFn` is not re-exported by the lib and
 * `@tanstack/react-table` is not a direct dependency here.
 */
export const multiSelectFilterFn: ColumnDef<any>['filterFn'] = coreMultiSelectFilterFn;
