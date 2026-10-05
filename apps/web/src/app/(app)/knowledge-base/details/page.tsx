'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ArticleDetailsPage } from '../components/article-details-page';

export default function ArticleDetailsPageWrapper() {
  const id = useSearchParams().get('id');
  if (!id) {
    notFound();
  }
  return (
    <ContentErrorBoundary title="Knowledge Base" message="Couldn't load this article.">
      <ArticleDetailsPage articleId={id} />
    </ContentErrorBoundary>
  );
}
