'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptTagsRelayFilterQuery as ScriptTagsFilterQueryType } from '@/__generated__/scriptTagsRelayFilterQuery.graphql';
import { NO_ITEMS, type SelectableTag, TagFilterBar, useRetryKey } from '@/app/components/shared';
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

/**
 * Scripts list tag filter — the shared `TagFilterBar` fed by `scriptsTags` (tags
 * actually assigned to scripts). `archived` scopes the set: `true` → tags on
 * archived scripts (the Archived page), null → tags on active scripts.
 * Owns its Suspense boundary: while the tag list loads the same bar, with no
 * tags, is drawn in the boundary's loading scope, where it draws its own
 * skeleton. The search takes input meanwhile (its node is replaced, the value
 * kept, when the tags land), and the URL's selected tags stay on it (their chips
 * are bars until the keys land), so Clear all clears both.
 */
export function ScriptsTagFilter(props: ScriptsTagFilterProps) {
  return (
    <LoadingSuspense live label="Loading script tags">
      <ScriptsTagFilterReader {...props} />
    </LoadingSuspense>
  );
}

function ScriptsTagFilterReader(props: ScriptsTagFilterProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope()) return <ScriptsTagFilterBar {...props} tags={NO_ITEMS} />;
  return <ScriptsTagFilterContent {...props} />;
}

function ScriptsTagFilterContent(props: ScriptsTagFilterProps) {
  const { archived = false } = props;
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptTagsFilterQueryType>(
    scriptTagsRelayFilterQuery,
    { archived: archived ? true : null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const tags = useMemo(() => data.scriptsTags.map(t => ({ id: t.id, key: t.key })), [data.scriptsTags]);

  return <ScriptsTagFilterBar {...props} tags={tags} />;
}

/** The one bar both states draw, so the two cannot drift: only the tag list differs. */
function ScriptsTagFilterBar({
  tags,
  search,
  onSearchChange,
  tagIds,
  onTagIdsChange,
  filterButton,
}: ScriptsTagFilterProps & { tags: ReadonlyArray<SelectableTag> }) {
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
