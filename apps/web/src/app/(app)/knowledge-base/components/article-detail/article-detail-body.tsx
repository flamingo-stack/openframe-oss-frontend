'use client';

import { graphql, useFragment } from 'react-relay';
import type { articleDetailBody_article$key } from '@/__generated__/articleDetailBody_article.graphql';
import { SimpleMarkdownRenderer } from '@/app/components/shared/lazy-markdown';

/** The text size the body renders at. */
const BODY_TEXT_SIZE = 'compact';

/** A typical article's length in body lines (its own is unknown until it arrives). */
const ARTICLE_BODY_SKELETON_LINES = 10;

const articleDetailBodyFragment = graphql`
  fragment articleDetailBody_article on KnowledgeBaseItem {
    content
  }
`;

/**
 * The article itself — its markdown, rendered. Before the article answers (a loading scope) the renderer has no
 * content and draws its own loading state: a typical article's lines at the body's text size.
 */
export function ArticleDetailBody({ article }: { article: articleDetailBody_article$key | null }) {
  const data = useFragment(articleDetailBodyFragment, article);
  return (
    <SimpleMarkdownRenderer
      content={data?.content ?? ''}
      textSize={BODY_TEXT_SIZE}
      skeletonLines={ARTICLE_BODY_SKELETON_LINES}
    />
  );
}
