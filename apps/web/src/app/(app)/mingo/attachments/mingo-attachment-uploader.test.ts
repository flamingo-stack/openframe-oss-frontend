/**
 * Mingo's chat files over the ai-agent's REST API: what each call sends, how the backend's statuses and refusals read
 * on a tile, and the download a sent file opens with.
 */
import { OpenFrameAttachmentUploadError } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMingoAttachmentUploader,
  fetchMingoAttachmentDownloadUrl,
  mingoAttachmentErrorOf,
  mingoAttachmentStatusOf,
} from './mingo-attachment-uploader';

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: api }));

const signal = new AbortController().signal;
const FILE = { name: 'disk.log', mediaType: 'text/plain', size: 2048 };

beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset();
});

describe('createUpload', () => {
  it("asks for the open dialog's upload URL and returns the server's id, URL and signed headers", async () => {
    api.post.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        attachment: { id: 'att_1', fileName: 'disk.log' },
        uploadUrl: 'https://storage/put',
        headers: { 'Content-Type': 'text/plain' },
      },
    });
    const target = await createMingoAttachmentUploader('d-1').createUpload(FILE, signal);

    expect(api.post).toHaveBeenCalledWith(
      '/chat/api/v1/chat-attachments',
      { fileName: 'disk.log', contentType: 'text/plain', fileSize: 2048, chatType: 'ADMIN_AI_CHAT', dialogId: 'd-1' },
      { signal },
    );
    expect(target).toEqual({
      attachmentId: 'att_1',
      uploadUrl: 'https://storage/put',
      uploadHeaders: { 'Content-Type': 'text/plain' },
    });
  });

  it('sends no dialog for a chat not created yet, and no headers when the URL was signed with none', async () => {
    api.post.mockResolvedValue({ ok: true, status: 200, data: { attachment: { id: 'att_1' }, uploadUrl: 'u' } });
    const target = await createMingoAttachmentUploader(null).createUpload(FILE, signal);

    expect(api.post.mock.calls[0][1]).not.toHaveProperty('dialogId');
    expect(target).toEqual({ attachmentId: 'att_1', uploadUrl: 'u' });
  });

  it("names the backend's refusal on the tile, and an unknown one as a failed upload", async () => {
    api.post.mockResolvedValueOnce({ ok: false, status: 400, data: { code: 'CHAT_LIMIT' }, error: 'Chat limit' });
    await expect(createMingoAttachmentUploader('d-1').createUpload(FILE, signal)).rejects.toMatchObject({
      name: 'OpenFrameAttachmentUploadError',
      code: 'CHAT_LIMIT',
    });

    api.post.mockResolvedValueOnce({ ok: false, status: 500, error: 'Request failed with status 500' });
    await expect(createMingoAttachmentUploader('d-1').createUpload(FILE, signal)).rejects.toMatchObject({
      code: 'UPLOAD_FAILED',
    });
  });

  it('fails an answer without an id or a URL', async () => {
    api.post.mockResolvedValue({ ok: true, status: 200, data: { attachment: { id: 'att_1' } } });
    await expect(createMingoAttachmentUploader('d-1').createUpload(FILE, signal)).rejects.toBeInstanceOf(
      OpenFrameAttachmentUploadError,
    );
  });
});

describe('completeUpload', () => {
  it('tells the server the bytes are up, and throws its refusal', async () => {
    api.post.mockResolvedValueOnce({ ok: true, status: 200, data: { id: 'att/1' } });
    await createMingoAttachmentUploader('d-1').completeUpload('att/1', signal);
    expect(api.post).toHaveBeenCalledWith('/chat/api/v1/chat-attachments/att%2F1/complete', undefined, { signal });

    api.post.mockResolvedValueOnce({ ok: false, status: 400, data: { code: 'TYPE_NOT_ALLOWED' } });
    await expect(createMingoAttachmentUploader('d-1').completeUpload('att_2', signal)).rejects.toMatchObject({
      code: 'TYPE_NOT_ALLOWED',
    });
  });
});

describe('getStatuses', () => {
  it('reads every waiting file in one call, with its state, error and token estimate', async () => {
    api.post.mockResolvedValue({
      ok: true,
      status: 200,
      data: [
        { attachmentId: 'att_1', status: 'READY', attachment: { id: 'att_1', estimatedTokens: 512 } },
        { attachmentId: 'att_2', status: 'SCANNING' },
        { attachmentId: 'att_3', status: 'FAILED', errorCode: 'TOO_LARGE' },
        { attachmentId: 'att_4', status: 'SOMETHING_NEW' },
      ],
    });
    const statuses = await createMingoAttachmentUploader('d-1').getStatuses(['att_1', 'att_2', 'att_3'], signal);

    expect(api.post).toHaveBeenCalledWith(
      '/chat/api/v1/chat-attachments/status',
      { attachmentIds: ['att_1', 'att_2', 'att_3'] },
      { signal },
    );
    expect(statuses).toEqual([
      { attachmentId: 'att_1', state: 'ready', tokenEstimate: 512 },
      { attachmentId: 'att_2', state: 'scanning' },
      { attachmentId: 'att_3', state: 'failed', error: 'TOO_LARGE' },
    ]);
  });

  it('throws a failed read, which the lib retries', async () => {
    api.post.mockResolvedValue({ ok: false, status: 503, error: 'Request failed with status 503' });
    await expect(createMingoAttachmentUploader('d-1').getStatuses(['att_1'], signal)).rejects.toThrow('503');
  });
});

describe('the backend codes', () => {
  it('keeps the ones a tile names and reads the rest as a failed upload', () => {
    expect(mingoAttachmentErrorOf('MESSAGE_LIMIT')).toBe('MESSAGE_LIMIT');
    expect(mingoAttachmentErrorOf('CONTEXT_LIMIT')).toBe('UPLOAD_FAILED');
    expect(mingoAttachmentErrorOf(undefined)).toBe('UPLOAD_FAILED');
    expect(mingoAttachmentStatusOf({ status: 'READY' })).toBeUndefined();
    expect(mingoAttachmentStatusOf({ attachmentId: 'a', status: 'FAILED' })).toEqual({
      attachmentId: 'a',
      state: 'failed',
      error: 'UPLOAD_FAILED',
    });
  });
});

describe('fetchMingoAttachmentDownloadUrl', () => {
  it("is the file's signed URL, and an error without one", async () => {
    api.get.mockResolvedValueOnce({ ok: true, status: 200, data: { downloadUrl: 'https://storage/get' } });
    await expect(fetchMingoAttachmentDownloadUrl('att_1')).resolves.toBe('https://storage/get');
    expect(api.get).toHaveBeenCalledWith('/chat/api/v1/chat-attachments/att_1/download');

    api.get.mockResolvedValueOnce({ ok: false, status: 404, error: 'Not found' });
    await expect(fetchMingoAttachmentDownloadUrl('att_1')).rejects.toThrow('Not found');
  });
});
