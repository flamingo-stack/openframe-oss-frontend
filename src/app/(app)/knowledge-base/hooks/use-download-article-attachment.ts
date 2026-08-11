'use client';

import { useCallback } from 'react';
import { graphql, useRelayEnvironment } from 'react-relay';
import { fetchQuery } from 'relay-runtime';
import type { useDownloadArticleAttachmentQuery as UseDownloadArticleAttachmentQueryType } from '@/__generated__/useDownloadArticleAttachmentQuery.graphql';
import { useFileDownload } from '@/lib/use-file-download';

const downloadArticleAttachmentQuery = graphql`
  query useDownloadArticleAttachmentQuery($attachmentId: ID!) {
    knowledgeBaseAttachmentDownloadUrl(attachmentId: $attachmentId)
  }
`;

export function useDownloadArticleAttachment() {
  const environment = useRelayEnvironment();
  const downloadFile = useFileDownload();

  const download = useCallback(
    (attachmentId: string, fileName: string) =>
      downloadFile(fileName, async () => {
        const data = await fetchQuery<UseDownloadArticleAttachmentQueryType>(
          environment,
          downloadArticleAttachmentQuery,
          { attachmentId },
          { fetchPolicy: 'network-only' },
        ).toPromise();
        return data?.knowledgeBaseAttachmentDownloadUrl;
      }),
    [environment, downloadFile],
  );

  return { download };
}
