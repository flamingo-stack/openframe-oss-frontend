'use client';

import { graphql, useFragment } from 'react-relay';
import type { articleDetailBody_article$key } from '@/__generated__/articleDetailBody_article.graphql';
import { SimpleMarkdownRenderer } from '../shared/lazy-markdown';

const articleDetailBodyFragment = graphql`
  fragment articleDetailBody_article on KnowledgeBaseItem {
    content
  }
`;

/** The article itself — its markdown, rendered. */
export function ArticleDetailBody({ article }: { article: articleDetailBody_article$key }) {
  const { content } = useFragment(articleDetailBodyFragment, article);
  return <SimpleMarkdownRenderer content={content ?? ''} textSize="compact" />;
}
