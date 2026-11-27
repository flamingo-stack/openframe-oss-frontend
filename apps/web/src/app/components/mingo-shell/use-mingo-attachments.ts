'use client';

import {
  type OpenFrameMessageAttachment,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type OpenFrameChatAttachments,
  openFrameSentAttachmentOf,
  type UnifiedChatState,
  useOpenFrameAttachmentUploads,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import {
  createMingoAttachmentUploader,
  fetchMingoAttachmentDownloadUrl,
} from '@/app/(app)/mingo/attachments/mingo-attachment-uploader';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useFileDownload } from '@/lib/use-file-download';

/** Files the thread already holds: the chat limit and the counter count them. */
export function chatFileCountOf(messages: UnifiedChatState['messages']): number {
  return messages.reduce((count, message) => count + (message.metadata?.openframeAttachments?.length ?? 0), 0);
}

/**
 * The composer's files for Mingo (`EmbeddableChat`'s `openframeAttachments`), behind `mingo-chat-attachments`: the
 * uploader for the open dialog, the tray's state, the files a send carries and a sent file's download. Undefined while
 * the flag is off or not answered yet, so the composer draws no attach control. The tray lives with the dock, so it
 * survives navigation like the draft does.
 */
export function useMingoAttachments(
  state: Pick<UnifiedChatState, 'activeDialogId' | 'messages'>,
): OpenFrameChatAttachments | undefined {
  const gate = useFeatureFlagGate('mingo-chat-attachments');
  const dialogId = state.activeDialogId ?? null;
  // The upload hook reads the latest uploader on each call; a stable one per dialog keeps its status poll steady.
  const uploader = useMemo(() => createMingoAttachmentUploader(dialogId), [dialogId]);
  const chatFileCount = chatFileCountOf(state.messages);
  const uploads = useOpenFrameAttachmentUploads({
    profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE,
    uploader,
    chatFileCount,
  });
  const downloadFile = useFileDownload();

  if (gate !== 'on') return undefined;
  return {
    profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE,
    items: uploads.items,
    chatFileCount,
    onAddFiles: uploads.addFiles,
    onRemove: uploads.remove,
    // The ready files go with the message (their server ids) and leave the tray.
    onMessageSend: () => uploads.takeForSend().map(openFrameSentAttachmentOf),
    onOpenAttachment: (attachment: OpenFrameMessageAttachment) => {
      void downloadFile(attachment.name, () => fetchMingoAttachmentDownloadUrl(attachment.id));
    },
  };
}
