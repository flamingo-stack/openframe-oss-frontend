'use client';

import { useSearchParams } from 'next/navigation';
import { ArticleFormView } from '../components/article-form/article-form-view';
import { KnowledgeBasePageShell } from '../components/shared/knowledge-base-page-shell';

export default function NewArticlePage() {
  // The folder "Add Article" was pressed in — the new article starts there.
  const folderId = useSearchParams().get('folderId');
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load the article form.">
      <ArticleFormView articleId={null} initialFolderId={folderId} />
    </KnowledgeBasePageShell>
  );
}
