'use client';

import type { TagSearchOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CURSOR_PAGER_KEYS, useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo } from 'react';
import type { SelectableTag } from '@/app/components/shared';
import { useSearchParam } from '@/app/hooks/use-search-param';

export interface TagSearchState {
  /** What the search box shows: the typed value, ahead of the URL while the debounce runs. */
  search: string;
  /**
   * The search the URL holds: what the query reads. Not the box's debounced value, which runs one commit ahead of the
   * URL: the write that carries a new search drops the pager's cursor in the same navigation, so a search and a cursor
   * from another narrowing never meet in one request.
   */
  urlSearch: string;
  setSearch: (value: string) => void;
  selectedTags: SelectableTag[];
  tagIds: string[];
  tagSearchOptions: TagSearchOption<string>[];
  addTag: (tag: SelectableTag) => void;
  removeTag: (id: string) => void;
  /** Replace the whole selected-tag set (search text is preserved). */
  setTags: (tags: SelectableTag[]) => void;
  clearAll: () => void;
}

// Tags persist in the URL as one `tags=<id>:<key>` entry each (repeated params,
// so commas/colons in keys are safe). IDs never contain ':', so we split on the
// first colon — the key may itself contain colons.
function encodeTag(tag: SelectableTag): string {
  return `${tag.id}:${tag.key}`;
}

function decodeTag(entry: string): SelectableTag | null {
  const i = entry.indexOf(':');
  if (i <= 0) return null;
  return { id: entry.slice(0, i), key: entry.slice(i + 1) };
}

/**
 * Search + tag filter state for Knowledge Base, persisted in the URL.
 *
 * Search is kept responsive via the shared {@link useSearchParam} hook (local
 * input state + debounced write to the URL param), so typing never lags behind a
 * router navigation and is never clobbered mid-fetch. Selected tags are encoded
 * into the `tags` URL param so the whole filter survives refresh / back-forward.
 *
 * Every list it narrows is paged with its cursor in the URL: a change to the search or the tags drops the pager's
 * cursor in the SAME URL write (one history entry on page 2+, so Back returns to the old view). `prefix` puts the
 * params beside a table that shares its page's query string (a tab: `articlesSearch`, `articlesTags`).
 */
export function useTagSearchState(prefix?: string): TagSearchState {
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      tags: { type: 'array', default: [] },
    },
    { prefix, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );

  const { search, setSearch } = useSearchParam(params.search, value => setParam('search', value), 300);

  const selectedTags = useMemo<SelectableTag[]>(
    () =>
      params.tags.flatMap(entry => {
        const tag = decodeTag(entry);
        return tag ? [tag] : [];
      }),
    [params.tags],
  );

  const tagIds = useMemo(() => selectedTags.map(t => t.id), [selectedTags]);

  const tagSearchOptions = useMemo<TagSearchOption<string>[]>(
    () => selectedTags.map(t => ({ label: t.key, value: t.id })),
    [selectedTags],
  );

  const addTag = useCallback(
    (tag: SelectableTag) => {
      if (params.tags.some(entry => decodeTag(entry)?.id === tag.id)) return;
      setParam('tags', [...params.tags, encodeTag(tag)]);
    },
    [params.tags, setParam],
  );

  const removeTag = useCallback(
    (id: string) => {
      setParam(
        'tags',
        params.tags.filter(entry => decodeTag(entry)?.id !== id),
      );
    },
    [params.tags, setParam],
  );

  const setTags = useCallback(
    (tags: SelectableTag[]) => {
      setParam('tags', tags.map(encodeTag));
    },
    [setParam],
  );

  const clearAll = useCallback(() => {
    setSearch('');
    setParams({ search: '', tags: [] });
  }, [setSearch, setParams]);

  return {
    search,
    urlSearch: params.search,
    setSearch,
    selectedTags,
    tagIds,
    tagSearchOptions,
    addTag,
    removeTag,
    setTags,
    clearAll,
  };
}
