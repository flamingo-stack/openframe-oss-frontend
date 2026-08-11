'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { downloadFileToDevice } from './native-files';

/**
 * Downloads a file with the user feedback the operation needs, for every caller
 * that resolves a URL first (attachments hand out short-lived presigned URLs, so
 * the fetch cannot start until a round trip finishes).
 *
 * Feedback is the whole point. On mobile the bytes move through the native layer
 * with nothing on screen, and both endings are easy to miss: iOS opens a share
 * sheet only once the transfer completes, and Android ≥29 writes straight to
 * Downloads with no OS-level signal at all. Without a pending toast a large file
 * reads as a frozen app, and a completed one as a button that did nothing.
 */
export function useFileDownload() {
  const { toast, dismiss } = useToast();

  return useCallback(
    async (fileName: string, resolveUrl: () => Promise<string | null | undefined>) => {
      const pending = toast({
        title: 'Downloading',
        description: fileName,
        // Persistent: the transfer has no progress to report, so the toast's job
        // is purely to prove the tap registered. Dismissed in the finally.
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      });

      try {
        const url = await resolveUrl();
        if (!url) throw new Error('No download URL returned');

        // 'shared' and 'browser' announce themselves — a share sheet appears, or
        // the browser shows its own download UI. Only a silent save needs saying.
        if ((await downloadFileToDevice(url, fileName)) === 'saved') {
          toast({ title: 'Saved to Downloads', description: fileName, variant: 'success' });
        }
      } catch (err) {
        toast({
          title: 'Download Failed',
          description: err instanceof Error ? err.message : 'Failed to download attachment',
          variant: 'destructive',
        });
      } finally {
        dismiss(pending);
      }
    },
    [toast, dismiss],
  );
}
