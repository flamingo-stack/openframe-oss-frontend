/** A filter dropdown option derived from a server facet entry. */
export interface FacetOption {
  id: string;
  label: string;
  value: string;
  count: number;
}

/**
 * Maps a server-driven facet (`ScriptFilterOption { value, label, count }`) to
 * label-sorted filter options. The option `value` is the facet's `value`
 * verbatim — it must match the corresponding server filter input field (e.g. a
 * user id for `initiatorIds`/`authorIds`, a machineId for `machineIds`), so it
 * round-trips through the URL param unchanged.
 */
export function facetToSortedOptions(
  facet: ReadonlyArray<{ readonly value: string; readonly label: string; readonly count: number }> | null | undefined,
): FacetOption[] {
  return (facet ?? [])
    .map(f => ({ id: f.value, label: f.label, value: f.value, count: f.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface FacetEntry {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Same as `facetToSortedOptions`, for facets whose `value` is a backend enum the
 * table filters by a UI id instead (shell, platform). `toId` returns that id, or
 * null for a member this UI has none for. Colliding ids sum their counts
 * (`MAC_OS` and `MACOS` both mean `darwin`). Server order is kept.
 */
export function facetToMappedOptions(
  facet: ReadonlyArray<FacetEntry> | null | undefined,
  toId: (value: string) => string | null | undefined,
): FacetOption[] {
  const byId = new Map<string, FacetOption>();

  for (const entry of facet ?? []) {
    const id = toId(entry.value);
    if (!id) continue;

    const existing = byId.get(id);
    if (existing) {
      existing.count += entry.count;
    } else {
      byId.set(id, { id, label: entry.label, value: id, count: entry.count });
    }
  }

  return Array.from(byId.values());
}
