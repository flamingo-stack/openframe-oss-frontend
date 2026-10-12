'use client';

import { Suspense } from 'react';
import { ArticleDetailContent } from './article-detail-content';
import { ArticleDetailSkeleton } from './article-detail-skeleton';

/**
 * `/knowledge-base/details`: one article. Not `PageLayout`: the title is the
 * record, so only the island that reads it waits (canon `software-detail-view`).
 */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  return (
    <div className="flex w-full flex-col">
      <Suspense fallback={<ArticleDetailSkeleton />}>
        <ArticleDetailContent articleId={articleId} />
      </Suspense>
    </div>
  );
}
