'use client';

import { Card, SquareAvatar, Tag, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailSummary_article$key } from '@/__generated__/articleDetailSummary_article.graphql';
import { InlineSkeleton } from '@/app/components/shared';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { formatDate } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { ARTICLE_STATUS_VARIANT, toArticleStatus } from '../shared/article-status';

const articleDetailSummaryFragment = graphql`
  fragment articleDetailSummary_article on KnowledgeBaseItem {
    status
    createdAt
    updatedAt
    author {
      firstName
      lastName
      email
      status
      image {
        imageUrl
        hash
      }
    }
  }
`;

// The cells' labels, shared with the skeleton: they are static, so the loading card draws them for real.
const LABELS = { author: 'Author', updated: 'Updated', status: 'Status' } as const;

const CELL_CLASSES = 'h-20';

/** The card's frame — three cells in a row on a wide screen, two over one below `lg`. */
function SummaryCard({ author, updated, status }: { author: ReactNode; updated: ReactNode; status: ReactNode }) {
  return (
    <Card className="border-ods-border px-[var(--spacing-system-mf)] py-0">
      <div className="grid grid-cols-2 gap-x-[var(--spacing-system-mf)] content-lg:grid-cols-3">
        {author}
        {updated}
        <div
          className="col-span-2 -mx-[var(--spacing-system-mf)] border-t border-ods-border content-lg:hidden"
          aria-hidden
        />
        {status}
      </div>
    </Card>
  );
}

/** The author's cell: the avatar beside the name, not on its line as `InfoCell` would put it. */
function AuthorCell({ avatar, name }: { avatar: ReactNode; name: ReactNode }) {
  return (
    <div className={`flex min-w-0 items-center gap-[var(--spacing-system-xsf)] ${CELL_CLASSES}`}>
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col">
        {name}
        <p className="truncate text-ods-text-secondary text-h6">{LABELS.author}</p>
      </div>
    </div>
  );
}

/** Who wrote the article, when it last changed and whether it is live. */
export function ArticleDetailSummary({ article }: { article: articleDetailSummary_article$key }) {
  const { status, createdAt, updatedAt, author } = useFragment(articleDetailSummaryFragment, article);

  const fullName = [author?.firstName, author?.lastName].filter(Boolean).join(' ');
  const authorName = fullName || author?.email || null;
  // A deleted account keeps its name here, drawn as deleted.
  const isDeletedAuthor = isDeletedUserStatus(author?.status);
  const articleStatus = toArticleStatus(status);

  return (
    <SummaryCard
      author={
        <AuthorCell
          avatar={
            isDeletedAuthor ? (
              <DeletedUserAvatar size="md" />
            ) : (
              <SquareAvatar
                src={getFullImageUrl(author?.image?.imageUrl, author?.image?.hash)}
                fallback={authorName ?? 'A'}
                alt={authorName ?? 'Author'}
                size="md"
                variant="round"
              />
            )
          }
          name={
            <TruncateText className={isDeletedAuthor ? 'text-ods-error' : undefined}>
              {authorName ?? 'Unknown'}
            </TruncateText>
          }
        />
      }
      updated={<InfoCell className={CELL_CLASSES} label={LABELS.updated} value={formatDate(updatedAt ?? createdAt)} />}
      status={
        <InfoCell
          className={CELL_CLASSES}
          label={LABELS.status}
          value={<Tag variant={ARTICLE_STATUS_VARIANT[articleStatus]} label={articleStatus} />}
        />
      }
    />
  );
}

/** The card while the article loads: its cells and labels real, its values as bars. */
export function ArticleDetailSummarySkeleton() {
  return (
    <div aria-busy>
      <SummaryCard
        author={
          <AuthorCell
            avatar={<InlineSkeleton className="size-10 rounded-full" />}
            name={<InlineSkeleton className="h-6 w-32" />}
          />
        }
        updated={
          <InfoCell className={CELL_CLASSES} label={LABELS.updated} value={<InlineSkeleton className="h-6 w-24" />} />
        }
        status={
          <InfoCell className={CELL_CLASSES} label={LABELS.status} value={<InlineSkeleton className="h-6 w-20" />} />
        }
      />
    </div>
  );
}
