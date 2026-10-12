import { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';

/** Tag colour of each article status — the list row and the article page draw the same one. */
export const ARTICLE_STATUS_VARIANT = {
  [KnowledgeBaseArticleStatus.PUBLISHED]: 'success',
  [KnowledgeBaseArticleStatus.DRAFT]: 'warning',
  [KnowledgeBaseArticleStatus.ARCHIVED]: 'grey',
} as const satisfies Record<KnowledgeBaseArticleStatus, string>;

/** The status as the pages act on it: an article that carries none is a draft. */
export function toArticleStatus(status: string | null | undefined): KnowledgeBaseArticleStatus {
  return status === KnowledgeBaseArticleStatus.PUBLISHED || status === KnowledgeBaseArticleStatus.ARCHIVED
    ? status
    : KnowledgeBaseArticleStatus.DRAFT;
}
