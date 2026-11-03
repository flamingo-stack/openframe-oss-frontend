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
 * A backend rejects the WHOLE query over a message part type or field its schema lacks. Three such things can be missing
 * from an older backend, and the first rejection naming one drops it for the session:
 *   - `AttachmentsData`: a backend from before saas-tenant#3633 has `GuideData` instead (the old fragment is used);
 *   - `RecordCardsData`: a backend from before saas-tenant#4330 stores no record cards (the fragment is left out);
 *   - `sourceId`: a backend from before CU-17tkuw61kfy has the old field names on both parts (the old fragments are used).
 *
 * TODO(CU-17tkuw61kfy): all three go at the cleanup, with `LEGACY_GUIDE_FRAGMENT` and the old fragments, once every
 * backend is past them (saas-tenant#3633, saas-tenant#4330, this change).
 */
let legacyGuide = false;
let recordCards = true;
let standardNames = true;

/** One rejection per flag at most, so a backend missing all of them still gets its answer. */
const FALLBACK_FLAGS = 3;

export async function fetchMingoDialogMessages(variables: MessagesVariables) {
  const post = () =>
    apiClient.post<MessagesResponse>('/chat/graphql', {
      query: getMingoDialogMessagesQuery({ legacyGuide, recordCards, standardNames }),
      variables,
    });

  let response = await post();
  for (let retry = 0; retry < FALLBACK_FLAGS; retry++) {
    const rejected = (name: string) => response.data?.errors?.some(error => error.message.includes(name)) ?? false;
    // `sourceId` before `RecordCardsData`: the rejection of the new names also says "Field 'records' in type
    // 'RecordCardsData'", and that backend has the type, with the old field in it.
    if (!legacyGuide && rejected('AttachmentsData')) legacyGuide = true;
    else if (standardNames && rejected('sourceId')) standardNames = false;
    else if (recordCards && rejected('RecordCardsData')) recordCards = false;
    else return response;
    response = await post();
  }
  return response;
}
