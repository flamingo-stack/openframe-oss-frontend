'use client';

import { type ReactNode, Suspense, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptTagsRelayFilterQuery as ScriptTagsFilterQueryType } from '@/__generated__/scriptTagsRelayFilterQuery.graphql';
import { TagFilterBar, useRetryKey } from '@/app/components/shared';
import { scriptTagsRelayFilterQuery } from '@/graphql/scripts/script-tags-relay';

const SEARCH_PLACEHOLDER = 'Search for Scripts';

interface ScriptsTagFilterProps {
  /** Free-text name search (kept in the search input alongside the tag chips). */
  search: string;
  onSearchChange: (value: string) => void;
  /** Selected Tag ids driving the `tagIds` filter. */
  tagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  /** Mobile filter button rendered next to the search input. */
  filterButton?: ReactNode;
  /** Archived list → scope tags to archived scripts (`archived: true`); otherwise active. */
  archived?: boolean;
}

const NO_TAGS: { id: string; key: string }[] = [];
const NO_IDS: string[] = [];
const noop = () => {};

/**
 * Scripts list tag filter — the shared `TagFilterBar` fed by `scriptsTags` (tags
 * actually assigned to scripts). `archived` scopes the set: `true` → tags on
 * archived scripts (the Archived page), null → tags on active scripts.
 * Owns its Suspense boundary: while the tag list loads the same bar draws its
 * tag row as a skeleton and keeps the search live.
 */
export function ScriptsTagFilter(props: ScriptsTagFilterProps) {
  const { search, onSearchChange, filterButton } = props;
  return (
    <Suspense
      fallback={
        <TagFilterBar
          loading
          tags={NO_TAGS}
          search={search}
          onSearchChange={onSearchChange}
          selectedIds={NO_IDS}
          onSelectedIdsChange={noop}
          placeholder={SEARCH_PLACEHOLDER}
          filterButton={filterButton}
        />
      }
    >
      <ScriptsTagFilterContent {...props} />
    </Suspense>
  );
}

function ScriptsTagFilterContent({
  search,
  onSearchChange,
  tagIds,
  onTagIdsChange,
  filterButton,
  archived = false,
}: ScriptsTagFilterProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptTagsFilterQueryType>(
    scriptTagsRelayFilterQuery,
    { archived: archived ? true : null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const tags = useMemo(() => data.scriptsTags.map(t => ({ id: t.id, key: t.key })), [data.scriptsTags]);

  return (
    <TagFilterBar
      tags={tags}
      search={search}
      onSearchChange={onSearchChange}
      selectedIds={tagIds}
      onSelectedIdsChange={onTagIdsChange}
      placeholder={SEARCH_PLACEHOLDER}
      filterButton={filterButton}
    />
  );
}
