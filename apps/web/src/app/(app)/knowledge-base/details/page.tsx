'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { ArticleDetailView } from '../components/article-detail/article-detail-view';
import { KnowledgeBasePageShell } from '../components/shared/knowledge-base-page-shell';

export default function ArticleDetailsPage() {
  const id = useSearchParams().get('id');
  if (!id) {
    notFound();
  }
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load this article." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      <ArticleDetailView key={id} articleId={id} />
    </KnowledgeBasePageShell>
  );
}
