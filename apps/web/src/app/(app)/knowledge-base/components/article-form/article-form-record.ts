import { graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type { articleFormRecord_article$key } from '@/__generated__/articleFormRecord_article.graphql';
import type { KnowledgeBaseArticleStatus } from '@/generated/schema-enums';
import { toArticleStatus } from '../shared/article-status';
import type { ArticleFormData } from './article-form.types';

const articleFormRecordFragment = graphql`
  fragment articleFormRecord_article on KnowledgeBaseItem @inline {
    name
    parentId
    content
    status
    tags {
      id
      key
    }
    attachments {
      id
      fileName
      fileSize
      contentType
    }
  }
`;

/** A file the article already has. */
export interface StoredAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

/**
 * The article as the edit form takes it in — everything but its assignments,
 * which are a second request off Relay (`useAssignedItems`).
 */
export interface ArticleFormRecord {
  values: Omit<ArticleFormData, 'assignments'>;
  status: KnowledgeBaseArticleStatus;
  /** The article's own tags, so the picker draws their chips before its own list is in. */
  tags: ReadonlyArray<{ id: string; key: string }>;
  attachments: ReadonlyArray<StoredAttachment>;
}

/** The article a save starts from: the form's seed, and the state the save is told apart from. */
export interface StoredArticle {
  values: ArticleFormData;
  status: KnowledgeBaseArticleStatus;
  attachments: ReadonlyArray<StoredAttachment>;
}

export function readArticleFormRecord(article: articleFormRecord_article$key): ArticleFormRecord {
  const { name, parentId, content, status, tags, attachments } = readInlineData(articleFormRecordFragment, article);
  return {
    values: {
      title: name,
      folderId: parentId ?? null,
      tags: tags.map(tag => tag.id),
      body: content ?? '',
    },
    status: toArticleStatus(status),
    tags: tags.map(tag => ({ id: tag.id, key: tag.key })),
    attachments: attachments.map(attachment => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize ?? 0,
      contentType: attachment.contentType ?? 'application/octet-stream',
    })),
  };
}
