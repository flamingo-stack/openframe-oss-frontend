'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCursorPager } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { routes } from '@/lib/routes';
import { KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseSearchToolbar } from '../shared/knowledge-base-search-toolbar';
import { useTagSearchState } from '../shared/use-tag-search-state';
import { ArchivedArticlesTable } from './archived-articles-table';

/**
 * `/knowledge-base/archive`: the archived articles. Owns the URL state (search +
 * tags, and the pager beside them: a top-level page, so no prefix) and the sticky
 * toolbar; the rows suspend below it. A change to the search or the tags drops the
 * cursor in the same URL write (`useTagSearchState`).
 */
export function ArchivedArticlesView() {
  const handleBack = useSafeBack(routes.knowledgeBase.list);
  const filters = useTagSearchState();
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  const pager = useCursorPager({
    pageSize: KNOWLEDGE_BASE_PAGE_SIZE,
    ...PAGED_LISTS.archivedArticles,
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

  const rows = (
    <ArchivedArticlesTable
      search={deferredSearch}
      tagIds={deferredTagIds}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={pager}
      pageVariables={deferredPage}
    />
  );

  return (
    <PageLayout title="Archived Articles" backButton={{ label: 'Back', onClick: handleBack }}>
      <div className="flex flex-col" style={containerStyle}>
        <KnowledgeBaseSearchToolbar
          toolbarRef={toolbarRef}
          placeholder="Search archived articles"
          parentId={null}
          archived
          filters={filters}
        />

        {/* The rows: the table places its own boundary and, before they answer, draws its own loading state. */}
        {rows}
      </div>
    </PageLayout>
  );
}
