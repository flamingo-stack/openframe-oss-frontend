'use client';

import { TicketAttachmentsList, TicketDetailSection } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { articleDetailAttachments_article$key } from '@/__generated__/articleDetailAttachments_article.graphql';
import { formatFileSize } from '@/app/(app)/devices/utils/file-manager-utils';
import { useDownloadArticleAttachment } from './use-download-article-attachment';

const articleDetailAttachmentsFragment = graphql`
  fragment articleDetailAttachments_article on KnowledgeBaseItem {
    attachments {
      id
      fileName
      fileSize
    }
  }
`;

/** The files attached to the article, each downloadable. An article without any draws nothing. */
export function ArticleDetailAttachments({ article }: { article: articleDetailAttachments_article$key }) {
  const { attachments } = useFragment(articleDetailAttachmentsFragment, article);
  const { download } = useDownloadArticleAttachment();

  if (attachments.length === 0) {
    return null;
  }
  return (
    <TicketDetailSection label="Attachments">
      <TicketAttachmentsList
        attachments={attachments.map(attachment => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize ? formatFileSize(attachment.fileSize) : '',
          onDownload: () => download(attachment.id, attachment.fileName),
        }))}
      />
    </TicketDetailSection>
  );
}
