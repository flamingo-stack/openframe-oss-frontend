/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

type ColumnFiltersUpdater = ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState);

/**
 * `useDataTable`'s controlled filter state for a table with one funnel, whose
 * selection lives outside the table (the URL, or a shell's state): the selected
 * values in, the funnel's changes out.
 */
export function singleColumnFilter(columnId: string, values: readonly string[], onChange: (values: string[]) => void) {
  const columnFilters: ColumnFilterState = values.length > 0 ? [{ id: columnId, value: values }] : [];

  // TanStack's updater signature: either the next state or a reducer over it.
  const onColumnFiltersChange = (updater: ColumnFiltersUpdater) => {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater;
    const value = next.find(filter => filter.id === columnId)?.value;
    onChange(Array.isArray(value) ? (value as string[]) : typeof value === 'string' ? [value] : []);
  };

  return { columnFilters, onColumnFiltersChange };
}

/**
 * The same for a table with several funnels, keyed by column id: every
 * column's selection in, and every column's selection out on any change — so
 * the caller writes them all back at once instead of guessing which moved.
 */
export function multiColumnFilter<K extends string>(
  selections: Readonly<Record<K, readonly string[]>>,
  onChange: (next: Record<K, string[]>) => void,
) {
  const columnIds = Object.keys(selections) as K[];
  const columnFilters: ColumnFilterState = columnIds.flatMap(id =>
    selections[id].length > 0 ? [{ id, value: selections[id] }] : [],
  );

  const onColumnFiltersChange = (updater: ColumnFiltersUpdater) => {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater;
    const pick = (id: K): string[] => {
      const value = next.find(filter => filter.id === id)?.value;
      return Array.isArray(value) ? (value as string[]) : typeof value === 'string' ? [value] : [];
    };
    onChange(Object.fromEntries(columnIds.map(id => [id, pick(id)])) as Record<K, string[]>);
  };

  return { columnFilters, onColumnFiltersChange };
}
