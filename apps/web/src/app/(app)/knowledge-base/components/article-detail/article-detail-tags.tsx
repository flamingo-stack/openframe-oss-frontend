'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailTags_article$key } from '@/__generated__/articleDetailTags_article.graphql';

const articleDetailTagsFragment = graphql`
  fragment articleDetailTags_article on KnowledgeBaseItem {
    tags {
      id
      key
    }
  }
`;

/** The article's tags, under its title. An untagged article draws nothing. */
export function ArticleDetailTags({ article }: { article: articleDetailTags_article$key }) {
  const { tags } = useFragment(articleDetailTagsFragment, article);
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-[var(--spacing-system-xsf)]">
      {tags.map(tag => (
        <Tag key={tag.id} label={tag.key} variant="outline" className="max-w-full" />
      ))}
    </div>
  );
}
