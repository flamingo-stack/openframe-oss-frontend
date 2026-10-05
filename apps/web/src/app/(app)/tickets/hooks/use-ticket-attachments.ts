'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useFileDownload } from '@/lib/use-file-download';
import { API_ENDPOINTS } from '../constants';
import { GET_TICKET_ATTACHMENT_DOWNLOAD_URL } from '../queries/ticket-queries';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';

interface DownloadUrlResponse {
  ticketAttachmentDownloadUrl: string;
}

export function useDownloadTicketAttachment() {
  const downloadFile = useFileDownload();

  const download = useCallback(
    (attachmentId: string, fileName: string) =>
      downloadFile(fileName, async () => {
        const response = await apiClient.post<GraphQlResponse<DownloadUrlResponse>>(API_ENDPOINTS.GRAPHQL, {
          query: GET_TICKET_ATTACHMENT_DOWNLOAD_URL,
          variables: { attachmentId },
        });
        return extractGraphQlData(response).ticketAttachmentDownloadUrl;
      }),
    [downloadFile],
  );

  return { download };
}
