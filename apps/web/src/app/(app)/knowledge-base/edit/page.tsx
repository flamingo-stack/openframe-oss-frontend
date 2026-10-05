'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { ArticleFormPage } from '../components/article-form-page';

export default function EditArticlePage() {
  const id = useRequiredIdParam(routes.knowledgeBase.list, routes.knowledgeBase.new());
  if (!id) return null;
  return <ArticleFormPage articleId={id} />;
}
