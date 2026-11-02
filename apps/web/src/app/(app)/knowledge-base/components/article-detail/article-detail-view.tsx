'use client';

import { ArticleDetailContent } from './article-detail-content';

/**
 * `/knowledge-base/details`: one article. Not `PageLayout`: the title is the
 * record, so only the island that reads it waits (canon `software-detail-view`).
 */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  return (
    <div className="flex w-full flex-col">
      <ArticleDetailContent articleId={articleId} />
    </div>
  );
}
