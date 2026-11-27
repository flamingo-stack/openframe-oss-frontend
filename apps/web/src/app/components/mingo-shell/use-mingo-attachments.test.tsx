/**
 * `useMingoAttachments`: the composer's files only while `mingo-chat-attachments` is on, the uploader for the open
 * dialog, the files the thread already holds, the ready files a send takes and a sent file's download.
 */
import type { OpenFrameChatAttachments } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { chatFileCountOf, useMingoAttachments } from './use-mingo-attachments';

const fake = vi.hoisted(() => ({
  /** What the lib's upload hook was given last. */
  options: null as { uploader: { dialogId: string | null }; chatFileCount: number } | null,
  takeForSend: vi.fn(),
  addFiles: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  downloadUrl: vi.fn(),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOpenFrameAttachmentUploads: (options: typeof fake.options) => {
    fake.options = options;
    return {
      items: [{ id: 'tray-1', name: 'disk.log', size: 2048, state: 'ready' }],
      addFiles: fake.addFiles,
      remove: fake.remove,
      takeForSend: fake.takeForSend,
    };
  },
}));
vi.mock('@/app/(app)/mingo/attachments/mingo-attachment-uploader', () => ({
  createMingoAttachmentUploader: (dialogId: string | null) => ({ dialogId }),
  fetchMingoAttachmentDownloadUrl: fake.downloadUrl,
}));
vi.mock('@/lib/use-file-download', () => ({ useFileDownload: () => fake.download }));

type State = Parameters<typeof useMingoAttachments>[0];

const sent = (...ids: string[]) => ({
  id: `m-${ids.join('-')}`,
  role: 'user' as const,
  parts: [],
  metadata: { openframeAttachments: ids.map(id => ({ id, name: id, mediaType: 'text/plain' })) },
});

let container: HTMLDivElement;
let root: Root;
const last: { value: OpenFrameChatAttachments | undefined } = { value: undefined };

function Probe({ state }: { state: State }) {
  const files = useMingoAttachments(state);
  useEffect(() => {
    last.value = files;
  });
  return null;
}

function render(state: State) {
  act(() => root.render(<Probe state={state} />));
}

function flag(enabled: boolean) {
  act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-chat-attachments', enabled }]));
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.options = null;
  last.value = undefined;
  useFeatureFlagsStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useMingoAttachments', () => {
  it('gives the composer nothing until the flag says on', () => {
    render({ activeDialogId: 'd-1', messages: [] });
    expect(last.value).toBeUndefined();
    flag(false);
    expect(last.value).toBeUndefined();
    flag(true);
    expect(last.value).toMatchObject({ chatFileCount: 0, items: [{ id: 'tray-1' }] });
    expect(last.value?.profile.maxFilesPerChat).toBeGreaterThan(0);
  });

  it("uploads into the open dialog, or a chat not created yet, and counts the thread's files", () => {
    flag(true);
    render({ activeDialogId: null, messages: [] });
    expect(fake.options?.uploader).toEqual({ dialogId: null });

    render({ activeDialogId: 'd-2', messages: [sent('a', 'b'), sent('c')] });
    expect(fake.options?.uploader).toEqual({ dialogId: 'd-2' });
    expect(fake.options?.chatFileCount).toBe(3);
    expect(last.value?.chatFileCount).toBe(3);
  });

  it('hands a send the ready files under their server ids, and passes adds and removes to the tray', () => {
    flag(true);
    render({ activeDialogId: 'd-1', messages: [] });
    fake.takeForSend.mockReturnValue([
      {
        attachmentId: 'att_1',
        item: { id: 'tray-1', name: 'disk.log', size: 2048, state: 'ready', mediaType: 'text/plain' },
      },
    ]);

    expect(last.value?.onMessageSend?.('see attached')).toEqual([
      { id: 'att_1', name: 'disk.log', mediaType: 'text/plain', size: 2048 },
    ]);
    const file = new File(['x'], 'x.txt');
    last.value?.onAddFiles([file]);
    last.value?.onRemove('tray-1');
    expect(fake.addFiles).toHaveBeenCalledWith([file]);
    expect(fake.remove).toHaveBeenCalledWith('tray-1');
  });

  it("downloads a sent file from its signed URL, under the file's name", async () => {
    flag(true);
    render({ activeDialogId: 'd-1', messages: [] });
    fake.downloadUrl.mockResolvedValue('https://storage/get');
    last.value?.onOpenAttachment?.({ id: 'att_1', name: 'disk.log', mediaType: 'text/plain' });

    expect(fake.download).toHaveBeenCalledWith('disk.log', expect.any(Function));
    const resolve = fake.download.mock.calls[0][1] as () => Promise<string>;
    await expect(resolve()).resolves.toBe('https://storage/get');
    expect(fake.downloadUrl).toHaveBeenCalledWith('att_1');
  });
});

describe('chatFileCountOf', () => {
  it('counts every file the thread shows, and none on rows without', () => {
    expect(chatFileCountOf([])).toBe(0);
    expect(chatFileCountOf([sent('a') as never, { id: 'x', role: 'assistant', parts: [] } as never])).toBe(1);
  });
});
