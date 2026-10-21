'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  TagSearchInput,
  type TagSearchOption,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type SelectableTag, SelectableTagsRow } from './selectable-tags-row';

interface TagFilterBarProps {
  /** Available tags — feed both the selectable row and the selected-chip labels. */
  tags: ReadonlyArray<SelectableTag>;
  search: string;
  onSearchChange: (value: string) => void;
  /** Selected tag ids driving the filter. */
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  placeholder: string;
  /**
   * Selected-tag chips for the search input. Defaults to deriving them from
   * `tags` + `selectedIds`; pass this when the selected tags can live outside the
   * current `tags` list (e.g. folder-scoped sources that persist a key per id).
   */
  selectedTags?: TagSearchOption<string>[];
  /**
   * The tags have not been read yet (a client read, or a Relay tag list still suspending): the search stays
   * usable and the tag row draws its own skeleton. Inside a loading scope the bar switches itself.
   */
  loading?: boolean;
  /** Render the selectable tags row. Default true (set false to hide it, e.g. on mobile). */
  showRow?: boolean;
  /** Element rendered next to the search input — typically a mobile "open filters" button. */
  filterButton?: ReactNode;
}

/**
 * Shared tag filter bar — a search input that doubles as a removable selected-tag
 * chip holder, with a one-click row of the remaining available tags underneath.
 * Returns the two rows as a fragment; wrap it in a `flex flex-col` container
 * (gap `--spacing-system-xxs`) so every consumer (scripts, tickets, …) lines up
 * identically. Data fetching stays with the caller.
 */
export function TagFilterBar({
  tags,
  search,
  onSearchChange,
  selectedIds,
  onSelectedIdsChange,
  placeholder,
  selectedTags,
  loading,
  showRow = true,
  filterButton,
}: TagFilterBarProps) {
  const isLoading = useLoadingScope() || !!loading;
  const keyById = new Map(tags.map(t => [t.id, t.key]));
  const derivedSelected = selectedIds.map(id => ({ value: id, label: keyById.get(id) ?? id }));
  // While the tags are read a selected chip whose key is not known yet is a bar, never its raw id.
  const renderTag =
    isLoading && !selectedTags
      ? (option: TagSearchOption<string>) =>
          keyById.has(option.value) ? option.label : <TextLineSkeleton type="inherit" as="span" className="w-12" />
      : undefined;

  return (
    <>
      <div className="flex items-center gap-[var(--spacing-system-m)]">
        <div className="min-w-0 flex-1">
          <TagSearchInput<string>
            tags={selectedTags ?? derivedSelected}
            searchValue={search}
            onSearchChange={onSearchChange}
            onTagRemove={id => onSelectedIdsChange(selectedIds.filter(selectedId => selectedId !== id))}
            onClearAll={() => {
              onSearchChange('');
              onSelectedIdsChange([]);
            }}
            placeholder={placeholder}
            addMorePlaceholder={placeholder}
            renderTag={renderTag}
          />
        </div>
        {filterButton}
      </div>

      {showRow && (
        <SelectableTagsRow
          tags={tags}
          selectedIds={selectedIds}
          onAdd={tag => onSelectedIdsChange([...selectedIds, tag.id])}
          loading={isLoading}
        />
      )}
    </>
  );
}
