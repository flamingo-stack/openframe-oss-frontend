import { apiClient } from '@/lib/api-client';
import type { MessagesResponse } from '../types';
import { getMingoDialogMessagesQuery } from './dialogs-queries';

interface MessagesVariables {
  dialogId: string;
  cursor?: string;
  limit: number;
  sortField: string;
  sortDirection: 'ASC' | 'DESC';
}

/**
 * A backend from before saas-tenant#3633 has `GuideData` where this one has
 * `AttachmentsData`, and rejects the WHOLE query over the unknown type. The
 * first such rejection moves the session to the old fragment.
 *
 * TODO(saas-tenant#3633): delete with `LEGACY_GUIDE_FRAGMENT` once every backend is past it.
 */
let legacyGuide = false;

export async function fetchMingoDialogMessages(variables: MessagesVariables) {
  const post = () =>
    apiClient.post<MessagesResponse>('/chat/graphql', {
      query: getMingoDialogMessagesQuery({ legacyGuide }),
      variables,
    });

  const response = await post();
  const isRejected = response.data?.errors?.some(error => error.message.includes('AttachmentsData'));
  if (legacyGuide || !isRejected) return response;

  legacyGuide = true;
  return post();
}
