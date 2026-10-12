'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { ArticleFormView } from '../components/article-form/article-form-view';
import { KnowledgeBasePageShell } from '../components/shared/knowledge-base-page-shell';

export default function EditArticlePage() {
  // `?id=` missing → the list; `?id=new` → the create page. Null while redirecting.
  const id = useRequiredIdParam(routes.knowledgeBase.list, routes.knowledgeBase.new());
  if (!id) {
    return null;
  }
  return (
    <KnowledgeBasePageShell errorMessage="Couldn't load this article." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      <ArticleFormView key={id} articleId={id} />
    </KnowledgeBasePageShell>
  );
}
