'use client';

import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailBody_article$key } from '@/__generated__/articleDetailBody_article.graphql';
import { SimpleMarkdownRenderer } from '../shared/lazy-markdown';

const articleDetailBodyFragment = graphql`
  fragment articleDetailBody_article on KnowledgeBaseItem {
    content
  }
`;

/** The article itself — its markdown, rendered. Null before the article answers. */
export function ArticleDetailBody({ article }: { article: articleDetailBody_article$key | null }) {
  const loading = useLoadingScope();
  const data = useFragment(articleDetailBodyFragment, article);
  if (loading || !data) {
    return <ArticleDetailBodySkeleton />;
  }
  return <SimpleMarkdownRenderer content={data.content ?? ''} textSize="compact" />;
}

/** The text as one block: its length is unknown until it arrives. */
function ArticleDetailBodySkeleton() {
  return <UnifiedSkeleton className="h-64 w-full" />;
}
