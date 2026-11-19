import type { DataTableFilterOption, FilterGroup } from '@flamingo-stack/openframe-frontend-core/components/ui';

/** One facet of a Software filters query (`softwareFilters`, `softwareDeviceFilters`): each value and how many have it. */
export type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

/**
 * A funnel's options from its facet. A value nothing has is not offered, nor one the column draws as the empty mark
 * (`labelFor` null). The label is the cell's word, the server's for a value this build does not know.
 */
export function facetOptions(
  facet: Facet,
  labelFor: (value: string) => string | null | undefined,
  /** The ticked values: kept at a count of 0, so a tick the other funnels emptied can still be taken off. */
  selected: readonly string[] = [],
): DataTableFilterOption[] {
  return facet.flatMap(option => {
    const label = labelFor(option.value);
    if (label === null || (option.count <= 0 && !selected.includes(option.value))) return [];
    return [{ id: option.value, value: option.value, label: label ?? option.label, count: option.count }];
  });
}

/**
 * A list's funnels again as its filter window's groups, for a narrow content area where the columns that carry them
 * are hidden: one group per column, titled as its header, with the column's own options.
 */
export function filterWindowGroups(
  funnels: ReadonlyArray<
    readonly [{ readonly id: string; readonly header?: string }, readonly DataTableFilterOption[]]
  >,
): FilterGroup[] {
  return funnels.map(([column, options]) => ({
    id: column.id,
    title: column.header ?? column.id,
    options: options.map(option => ({ id: String(option.value), label: option.label, count: option.count })),
  }));
}

/** The filter window's answer as each funnel's selection, keyed as the funnels: an untouched group selects nothing. */
export function filterWindowSelections<Key extends string>(
  keys: readonly Key[],
  filters: Record<string, unknown>,
): Record<Key, string[]> {
  return Object.fromEntries(keys.map(key => [key, (filters[key] as string[] | undefined) ?? []])) as Record<
    Key,
    string[]
  >;
}

/**
 * A list's filter for one funnel's facet: the list's own filter without that funnel's field, so each funnel counts
 * over the search and the OTHER funnels (ticking Windows narrows Engine's counts, not OS's own). Null when nothing is
 * left, as the queries take "unfiltered".
 */
export function facetScope<Filter extends object>(filter: Filter | null, field: keyof Filter): Filter | null {
  if (!filter) return null;
  const left = Object.entries(filter).filter(
    ([key, value]) => key !== field && value != null && !(Array.isArray(value) && value.length === 0),
  );
  return left.length > 0 ? (Object.fromEntries(left) as Filter) : null;
}
