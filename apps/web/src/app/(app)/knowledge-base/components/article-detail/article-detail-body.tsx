'use client';

import { MarkdownEngineSkeleton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailBody_article$key } from '@/__generated__/articleDetailBody_article.graphql';
import { SimpleMarkdownRenderer } from '@/app/components/shared/lazy-markdown';

/** The text size the body renders at, read by the skeleton so its bars take the body's line height. */
const BODY_TEXT_SIZE = 'compact';

/** A typical article's length in body lines (its own is unknown until it arrives). */
const ARTICLE_BODY_SKELETON_LINES = 10;

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
  return <SimpleMarkdownRenderer content={data.content ?? ''} textSize={BODY_TEXT_SIZE} />;
}

/** The text as a typical article's lines, at the body's own text size: its length is unknown until it arrives. */
function ArticleDetailBodySkeleton() {
  return <MarkdownEngineSkeleton textSize={BODY_TEXT_SIZE} lines={ARTICLE_BODY_SKELETON_LINES} />;
}
