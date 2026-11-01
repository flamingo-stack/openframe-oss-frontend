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
 * A backend rejects the WHOLE query over a message part type its schema lacks. Two such parts can be missing from an
 * older backend, and the first rejection naming one drops it for the session:
 *   - `AttachmentsData`: a backend from before saas-tenant#3633 has `GuideData` instead (the old fragment is used);
 *   - `RecordCardsData`: a backend from before saas-tenant#4330 stores no record cards (the fragment is left out).
 *
 * TODO(saas-tenant#3633): delete `legacyGuide` with `LEGACY_GUIDE_FRAGMENT` once every backend is past it.
 * TODO(saas-tenant#4330): delete `recordCards` once every backend is past it.
 */
let legacyGuide = false;
let recordCards = true;

export async function fetchMingoDialogMessages(variables: MessagesVariables) {
  const post = () =>
    apiClient.post<MessagesResponse>('/chat/graphql', {
      query: getMingoDialogMessagesQuery({ legacyGuide, recordCards }),
      variables,
    });

  let response = await post();
  for (let retry = 0; retry < 2; retry++) {
    const rejected = (type: string) => response.data?.errors?.some(error => error.message.includes(type)) ?? false;
    if (!legacyGuide && rejected('AttachmentsData')) legacyGuide = true;
    else if (recordCards && rejected('RecordCardsData')) recordCards = false;
    else return response;
    response = await post();
  }
  return response;
}
