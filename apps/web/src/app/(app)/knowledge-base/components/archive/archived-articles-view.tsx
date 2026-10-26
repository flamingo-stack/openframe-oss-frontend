'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';

import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { KnowledgeBaseSearchToolbar } from '../shared/knowledge-base-search-toolbar';
import { useTagSearchState } from '../shared/use-tag-search-state';
import { ArchivedArticlesTable } from './archived-articles-table';

/**
 * `/knowledge-base/archive`: the archived articles. Owns the URL state (search +
 * tags) and the sticky toolbar; the rows suspend below it.
 */
export function ArchivedArticlesView() {
  const handleBack = useSafeBack(routes.knowledgeBase.list);
  const filters = useTagSearchState();
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // Search and tags are deferred together, so `isPending` covers both.
  const {
    deferredFilters: deferredTagIds,
    deferredSearch,
    isPending,
  } = useDeferredQuery(filters.tagIds, filters.debouncedSearch);

  const rows = (
    <ArchivedArticlesTable
      search={deferredSearch}
      tagIds={deferredTagIds}
      isPending={isPending}
      stickyHeaderOffset={stickyHeaderOffset}
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
