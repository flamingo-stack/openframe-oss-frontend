import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecordingDetail } from '../types/session-recording';
import { RecordingUnavailableError, sessionRecordingsService } from './session-recordings-service';

function detail(overrides: Partial<RecordingDetail>): RecordingDetail {
  return {
    id: 'rec-1',
    deviceId: 'dev-1',
    startedAt: '2026-09-23T19:57:29Z',
    durationMs: 2_015_000,
    sizeBytes: 3,
    protocol: 2,
    processing: false,
    employee: { name: 'Roman Smith' },
    hostname: 'WIN-3A3KP1QG4VP',
    organization: { id: 'org-1', name: 'Acme' },
    segments: [
      { id: 'seg-1', downloadUrl: 'https://storage.test/seg-1', sizeBytes: 1 },
      { id: 'seg-2', downloadUrl: 'https://storage.test/seg-2', sizeBytes: 2 },
    ],
    chat: [],
    ...overrides,
  };
}

function okResponse(byte: number): Response {
  return new Response(new Uint8Array([byte]), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessionRecordingsService.downloadRecording', () => {
  it('fetches every segment and returns the buffers in segment order', async () => {
    const fetchMock = vi.fn(async (url: string) => okResponse(url.endsWith('seg-1') ? 1 : 2));
    vi.stubGlobal('fetch', fetchMock);

    const buffers = await sessionRecordingsService.downloadRecording(detail({}));

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://storage.test/seg-1',
      'https://storage.test/seg-2',
    ]);
    expect(buffers.map(b => new Uint8Array(b)[0])).toEqual([1, 2]);
  });

  it('is unavailable while processing, with no segments, or when a segment has no URL yet', async () => {
    const fetchMock = vi.fn(async () => okResponse(1));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sessionRecordingsService.downloadRecording(detail({ processing: true }))).rejects.toBeInstanceOf(
      RecordingUnavailableError,
    );
    await expect(sessionRecordingsService.downloadRecording(detail({ segments: [] }))).rejects.toBeInstanceOf(
      RecordingUnavailableError,
    );
    await expect(
      sessionRecordingsService.downloadRecording(
        detail({
          segments: [
            { id: 'seg-1', downloadUrl: 'https://storage.test/seg-1', sizeBytes: 1 },
            { id: 'seg-2', sizeBytes: 2 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(RecordingUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is unavailable when any segment fails to download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('seg-2') ? new Response(null, { status: 404 }) : okResponse(1))),
    );

    await expect(sessionRecordingsService.downloadRecording(detail({}))).rejects.toBeInstanceOf(
      RecordingUnavailableError,
    );
  });
});
