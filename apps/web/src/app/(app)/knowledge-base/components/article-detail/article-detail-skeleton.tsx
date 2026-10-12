'use client';

import { type PageActionButton, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ArticleDetailSummarySkeleton } from './article-detail-summary';
import { ArticleDetailTitle } from './article-detail-title';

/** The entry every status but "archived" settles into — the placeholder is sized off it. */
const LOADING_ACTIONS: PageActionButton[] = [{ label: 'Edit Article' }];

/** `ArticleDetailContent` while the article loads. The text is one block: its length is unknown until it arrives. */
export function ArticleDetailSkeleton() {
  return (
    <>
      <ArticleDetailTitle title="Article" loading actions={LOADING_ACTIONS} loadingActions />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <ArticleDetailSummarySkeleton />
        <Skeleton className="h-64 w-full" />
      </div>
    </>
  );
}
