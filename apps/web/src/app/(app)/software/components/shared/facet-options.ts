import type { DataTableFilterOption } from '@flamingo-stack/openframe-frontend-core/components/ui';

/** One facet of a Software filters query (`softwareFilters`, `softwareDeviceFilters`): each value and how many have it. */
export type Facet = ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }>;

/**
 * A funnel's options from its facet. A value nothing has is not offered, nor one the column draws as the empty mark
 * (`labelFor` null). The label is the cell's word, the server's for a value this build does not know.
 */
export function facetOptions(
  facet: Facet,
  labelFor: (value: string) => string | null | undefined,
): DataTableFilterOption[] {
  return facet.flatMap(option => {
    const label = labelFor(option.value);
    if (option.count <= 0 || label === null) return [];
    return [{ id: option.value, value: option.value, label: label ?? option.label, count: option.count }];
  });
}
