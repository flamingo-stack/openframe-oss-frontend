import { createRecordLinkScanner, parseRecordHref } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
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
 * from an older backend, and the first rejection naming one drops it:
 *   - `AttachmentsData`: a backend from before saas-tenant#3633 has `GuideData` instead (the old fragment is used). Older
 *     than the new names too: `sourceId` sits inside that type, so it never rejects the field, and only this says so;
 *   - `RecordCardsData`: a backend from before saas-tenant#4330 stores no record cards (the fragment is left out);
 *   - `sourceId`: a backend from before CU-17tkuw61kfy has the old field names on both parts (the old fragments are used).
 *
 * TODO(CU-17tkuw61kfy): all three go at the cleanup, with `LEGACY_GUIDE_FRAGMENT` and the old fragments, once every
 * backend is past them (saas-tenant#3633, saas-tenant#4330, this change).
 */
const NEWEST = { legacyGuide: false, recordCards: true, standardNames: true };

let schema = NEWEST;
/** Whether a read has answered, so `schema` says what this backend has rather than what it was assumed to have. */
let schemaKnown = false;
let fellBackAt = 0;

/** One rejection per flag at most, so a backend missing all of them still gets its answer. */
const FALLBACK_FLAGS = 3;

/**
 * A fallback holds this long, then the next read asks for the newest shape again: a desktop page lives for days, and the
 * rollout upgrades the backend under it. Asking costs an old backend its rejections once per interval.
 */
export const FALLBACK_RECHECK_MS = 10 * 60 * 1000;

/** The shape to ask for: the one that answered, or the newest again once a fallback has held long enough. */
function shapeToAsk(): typeof NEWEST {
  if (schema === NEWEST || Date.now() - fellBackAt < FALLBACK_RECHECK_MS) return schema;
  fellBackAt = Date.now();
  return NEWEST;
}

function noteFallback(): void {
  if (schema === NEWEST) fellBackAt = Date.now();
}

/** What a read that answered proves. */
function noteAnswered(asked: typeof NEWEST): void {
  schema = asked.legacyGuide || !asked.recordCards || !asked.standardNames ? asked : NEWEST;
  schemaKnown = true;
}

export async function fetchMingoDialogMessages(variables: MessagesVariables) {
  let asked = shapeToAsk();

  const post = () =>
    apiClient.post<MessagesResponse>('/chat/graphql', {
      query: getMingoDialogMessagesQuery(asked),
      variables,
    });

  let response = await post();
  for (let retry = 0; retry < FALLBACK_FLAGS; retry++) {
    const rejected = (name: string) => response.data?.errors?.some(error => error.message.includes(name)) ?? false;
    // `sourceId` before `RecordCardsData`: the rejection of the new names also says "Field 'records' in type
    // 'RecordCardsData'", and that backend has the type, with the old field in it.
    if (!asked.legacyGuide && rejected('AttachmentsData'))
      asked = { ...asked, legacyGuide: true, standardNames: false };
    else if (asked.standardNames && rejected('sourceId')) asked = { ...asked, standardNames: false };
    else if (asked.recordCards && rejected('RecordCardsData')) asked = { ...asked, recordCards: false };
    else break;
    noteFallback();
    response = await post();
  }
  // A read that failed for another reason says nothing about the schema.
  if (response.data?.data) noteAnswered(asked);
  return response;
}

/**
 * What to send a backend for what a person wrote: a backend from before CU-17tkuw61kfy reads a mention only as
 * `@marker:id`, so it would anchor no attached record and put the raw link in the dialog's title. A send with a record
 * link waits for one read if none has answered yet, because a new chat's first prompt is the usual place for one.
 *
 * TODO(CU-17tkuw61kfy): goes with the `standardNames` flag.
 */
export async function textForMingoBackend(dialogId: string, text: string): Promise<string> {
  if (!text.includes('record://')) return text;
  if (!schemaKnown) {
    await fetchMingoDialogMessages({ dialogId, limit: 1, sortField: 'createdAt', sortDirection: 'DESC' }).catch(
      () => undefined,
    );
  }
  if (schema.standardNames) return text;
  return text.replace(createRecordLinkScanner(), (link: string, _label: string, href: string) => {
    const record = parseRecordHref(href);
    return record ? `@${record.type}:${record.id}` : link;
  });
}
