'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { TableSkeleton } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { routes } from '@/lib/routes';
import { KNOWLEDGE_BASE_PAGE_SIZE } from '../shared/knowledge-base-item-columns';
import { KnowledgeBaseSearchToolbar } from '../shared/knowledge-base-search-toolbar';
import { useTagSearchState } from '../shared/use-tag-search-state';
import { ARCHIVED_ARTICLE_TABLE_COLUMNS } from './archived-articles-columns';
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

        <Suspense
          fallback={
            <TableSkeleton
              columns={ARCHIVED_ARTICLE_TABLE_COLUMNS}
              rows={KNOWLEDGE_BASE_PAGE_SIZE}
              stickyHeaderOffset={stickyHeaderOffset}
            />
          }
        >
          <ArchivedArticlesTable
            search={deferredSearch}
            tagIds={deferredTagIds}
            isPending={isPending}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </Suspense>
      </div>
    </PageLayout>
  );
}
