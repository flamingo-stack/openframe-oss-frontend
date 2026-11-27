/**
 * Mingo's chat files over the ai-agent's REST API (`/api/v1/chat-attachments`, through the `/chat` gateway): the
 * lib's `OpenFrameAttachmentUploader` (create, complete, status) and the signed download a sent file opens with.
 * The lib PUTs the bytes to the presigned URL itself; every call here goes through `apiClient` (cookies, bearer,
 * client identity).
 */

import {
  type OpenFrameAttachmentErrorCode,
  type OpenFrameAttachmentServerState,
  type OpenFrameAttachmentServerStatus,
  type OpenFrameAttachmentUploader,
  OpenFrameAttachmentUploadError,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { type ApiResponse, apiClient } from '@/lib/api-client';

/** The ai-agent's chat-files resource, as the gateway serves it. */
export const MINGO_CHAT_ATTACHMENTS_PATH = '/chat/api/v1/chat-attachments';

/** Mingo's chat in the ai-agent's `ChatType`. */
const ADMIN_AI_CHAT = 'ADMIN_AI_CHAT';

/** `ChatAttachmentReference`. */
interface WireAttachment {
  id?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  estimatedTokens?: number | null;
}

/** `ChatAttachmentUploadResponse`. */
interface WireUploadTarget {
  attachment?: WireAttachment | null;
  uploadUrl?: string | null;
  headers?: Record<string, string> | null;
}

/** `ChatAttachmentStatusResponse`. */
interface WireStatus {
  attachmentId?: string | null;
  status?: string | null;
  attachment?: WireAttachment | null;
  errorCode?: string | null;
}

/** `ChatAttachmentErrorResponse`, the body of a refused call. */
interface WireRefusal {
  code?: string | null;
}

const STATES: Readonly<Record<string, OpenFrameAttachmentServerState>> = {
  UPLOADING: 'uploading',
  SCANNING: 'scanning',
  READY: 'ready',
  FAILED: 'failed',
};

/** The backend's codes a tile can name; the rest (`NOT_FOUND`, `INVALID_ATTACHMENT`, …) read as a failed upload. */
const NAMED_ERRORS: readonly OpenFrameAttachmentErrorCode[] = [
  'TOO_LARGE',
  'TYPE_NOT_ALLOWED',
  'CHAT_LIMIT',
  'MESSAGE_LIMIT',
  'BLOCKED',
  'UPLOAD_FAILED',
];

/** A backend `ChatAttachmentErrorCode` as the tile shows it. */
export function mingoAttachmentErrorOf(code: unknown): OpenFrameAttachmentErrorCode {
  return NAMED_ERRORS.find(named => named === code) ?? 'UPLOAD_FAILED';
}

/** The answer's data, or the refusal as the error the tile names. */
function answerOf<T>(response: ApiResponse<T>): T | undefined {
  if (response.ok) return response.data;
  const refusal = response.data as WireRefusal | undefined;
  throw new OpenFrameAttachmentUploadError(mingoAttachmentErrorOf(refusal?.code), response.error);
}

/** One status row as the lib reads it; undefined for a row without an id or a state it knows. */
export function mingoAttachmentStatusOf(row: WireStatus): OpenFrameAttachmentServerStatus | undefined {
  const state = row.status ? STATES[row.status] : undefined;
  if (!row.attachmentId || !state) return undefined;
  const tokens = row.attachment?.estimatedTokens;
  return {
    attachmentId: row.attachmentId,
    state,
    ...(state === 'failed' ? { error: mingoAttachmentErrorOf(row.errorCode) } : {}),
    ...(typeof tokens === 'number' && Number.isFinite(tokens) ? { tokenEstimate: tokens } : {}),
  };
}

/**
 * The uploader for the dialog open now (`dialogId`), or for a chat not created yet (null): the backend binds such a
 * file to the dialog its message is sent in.
 */
export function createMingoAttachmentUploader(dialogId: string | null): OpenFrameAttachmentUploader {
  return {
    createUpload: async ({ name, mediaType, size }, signal) => {
      const target = answerOf(
        await apiClient.post<WireUploadTarget>(
          MINGO_CHAT_ATTACHMENTS_PATH,
          {
            fileName: name,
            contentType: mediaType,
            fileSize: size,
            chatType: ADMIN_AI_CHAT,
            ...(dialogId ? { dialogId } : {}),
          },
          { signal },
        ),
      );
      const attachmentId = target?.attachment?.id;
      if (!attachmentId || !target?.uploadUrl) throw new OpenFrameAttachmentUploadError('UPLOAD_FAILED');
      return {
        attachmentId,
        uploadUrl: target.uploadUrl,
        ...(target.headers ? { uploadHeaders: target.headers } : {}),
      };
    },
    completeUpload: async (attachmentId, signal) => {
      answerOf(
        await apiClient.post(`${MINGO_CHAT_ATTACHMENTS_PATH}/${encodeURIComponent(attachmentId)}/complete`, undefined, {
          signal,
        }),
      );
    },
    getStatuses: async (attachmentIds, signal) => {
      const response = await apiClient.post<WireStatus[]>(
        `${MINGO_CHAT_ATTACHMENTS_PATH}/status`,
        { attachmentIds: [...attachmentIds] },
        { signal },
      );
      // A failed read is retried by the lib (three in a row fail the waiting files), so it is a plain error here.
      if (!response.ok) throw new Error(response.error ?? 'Could not read the files’ status');
      return (response.data ?? []).flatMap(row => mingoAttachmentStatusOf(row) ?? []);
    },
  };
}

/** A sent file's short-lived download URL. */
export async function fetchMingoAttachmentDownloadUrl(attachmentId: string): Promise<string> {
  const response = await apiClient.get<{ downloadUrl?: string | null }>(
    `${MINGO_CHAT_ATTACHMENTS_PATH}/${encodeURIComponent(attachmentId)}/download`,
  );
  if (!response.ok || !response.data?.downloadUrl) throw new Error(response.error ?? 'Could not open the file');
  return response.data.downloadUrl;
}
