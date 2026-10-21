'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { Suspense } from 'react';
import { ArticleDetailContent } from './article-detail-content';

/**
 * `/knowledge-base/details`: one article. Not `PageLayout`: the title is the
 * record, so only the island that reads it waits (canon `software-detail-view`).
 */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  return (
    <div className="flex w-full flex-col">
      <Suspense
        fallback={
          <LoadingFallback label="Loading article">
            <ArticleDetailContent articleId={articleId} />
          </LoadingFallback>
        }
      >
        <ArticleDetailContent articleId={articleId} />
      </Suspense>
    </div>
  );
}
