'use client';

import { Filter02Icon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, TagSearchInput } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { ASSIGNED_ITEMS_QUERY_KEY } from '@/components/assignments';
import { useListRefreshEpoch } from '@/lib/list-refresh';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseTagsFilterModal } from '../shared/knowledge-base-tags-filter-modal';
import { useTagSearchState } from '../shared/use-tag-search-state';
import { AssignArticleModal } from './assign-article-modal';
import { AssignedArticlesTable } from './assigned-articles-table';
import type { AssignedArticlesTarget } from './assigned-articles-target';

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

/**
 * The tab's URL prefix: it shares its page's query string with every sibling tab, so its search, tags and pager sit
 * under their own keys (`articlesSearch`, `articlesTags`, `articlesCursor`, `articlesPage`, `articlesRefresh`).
 */
const PARAM_PREFIX = 'articles';

interface AssignedArticlesTabProps {
  /**
   * Whose articles the tab lists; null while the page has not read it yet: the tab is drawn in a loading scope (its
   * table its own loading state, no query run), with Assign real and inert.
   */
  target: AssignedArticlesTarget | null;
}

/**
 * The Assigned Articles tab of a customer and of a device: the knowledge base
 * articles assigned to it, searchable and filterable by tag, one page at a time
 * with First · Prev · Next, plus the Assign Article modal and an Unassign per row.
 *
 * The search, the tags and the pager live in the URL under the tab's prefix: a change to the search or the tags drops
 * the cursor in the SAME URL write (one history entry on page 2+, so Back returns to the old view).
 */
export function AssignedArticlesTab({ target }: AssignedArticlesTabProps) {
  const queryClient = useQueryClient();
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const filters = useTagSearchState(PARAM_PREFIX);
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: KNOWLEDGE_BASE_PAGE_SIZE,
    ...PAGED_LISTS.assignedItems,
    resetOn: JSON.stringify({ search: filters.urlSearch, tagIds: filters.tagIds }),
  });
  // Search, tags and the page are deferred together, so `isPending` covers all three. The query reads the search
  // from the URL, the write that drops the cursor.
  const {
    deferredFilters: deferredTagIds,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(filters.tagIds, filters.urlSearch, pager.variables);

  const [isEmpty, setIsEmpty] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  // An assign or an unassign marks the list changed: the tags on offer are asked for again with it.
  const assignmentsChanged = useListRefreshEpoch('assignedItems');

  // The article page lists its assignees from `assignedItems` (react-query).
  const handleChanged = () => void queryClient.invalidateQueries({ queryKey: ASSIGNED_ITEMS_QUERY_KEY });

  const rows = (
    <AssignedArticlesTable
      target={target}
      listing={{ search: deferredSearch, tagIds: deferredTagIds }}
      isPending={isPending}
      onChanged={handleChanged}
      onEmptyChange={setIsEmpty}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={pager}
      pageVariables={deferredPage}
      paramPrefix={PARAM_PREFIX}
    />
  );
  // Suspends on the tags; while they load the modal is drawn in a loading scope, its own loading state.
  const tagsModal = (
    <KnowledgeBaseTagsFilterModal
      isOpen={isTagsOpen}
      onClose={() => setIsTagsOpen(false)}
      parentId={null}
      archived={false}
      assignedTo={target}
      refreshKey={assignmentsChanged}
      selectedIds={filters.tagIds}
      onApply={filters.setTags}
    />
  );

  const pending = target == null;

  return (
    <LoadingWhen loading={pending}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
        <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-system-m)]">
          <h2 className="text-ods-text-primary text-h2">Assigned Articles</h2>
          <ResponsiveActionButton
            label="Assign Article"
            icon={<PlusCircleIcon className={ICON_CLASS} />}
            onClick={() => setIsAssignOpen(true)}
            disabled={pending}
          />
        </div>

        <div className="flex flex-col">
          {/* Nothing assigned at all: the empty state stands alone, with nothing to search. */}
          {!isEmpty && (
            <div
              ref={toolbarRef}
              className="sticky top-0 z-20 -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
            >
              <div className="min-w-0 flex-1">
                <TagSearchInput<string>
                  tags={filters.tagSearchOptions}
                  searchValue={filters.search}
                  onSearchChange={filters.setSearch}
                  onTagRemove={filters.removeTag}
                  onClearAll={filters.clearAll}
                  placeholder="Search for Articles"
                  addMorePlaceholder="Search for Articles"
                />
              </div>
              <ResponsiveActionButton
                label="Article Tags"
                icon={<Filter02Icon className={ICON_CLASS} />}
                onClick={() => setIsTagsOpen(true)}
              />
            </div>
          )}

          {/* The rows: the table places its own boundary and, before they answer, draws its own loading state. */}
          {rows}
        </div>

        {/* Beside the toolbar, not inside it: the bar is a stacking context (`sticky` + `z-20`),
          and a modal inside it could never rise above the app header. */}
        {/* The dialogs act on the target: mounted once it is known. */}
        {target && (
          <>
            {tagsModal}
            <AssignArticleModal
              target={target}
              isOpen={isAssignOpen}
              onClose={() => setIsAssignOpen(false)}
              onAssigned={handleChanged}
            />
          </>
        )}
      </div>
    </LoadingWhen>
  );
}
