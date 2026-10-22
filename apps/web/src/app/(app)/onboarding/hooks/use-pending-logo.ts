'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A logo picked BEFORE the record it belongs to exists: held in memory with an
 * object-URL preview, uploaded by the caller once the record has an id. Revokes
 * the preview on replacement and on unmount.
 *
 * Shared by the two surfaces that create the first customer during onboarding -
 * the Initial Setup card's step and the setup wizard's customer screen.
 */
export function usePendingLogo() {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const previewUrlRef = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const replace = useCallback((file: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (file) {
      const next = URL.createObjectURL(file);
      previewUrlRef.current = next;
      setPreviewUrl(next);
    } else {
      previewUrlRef.current = undefined;
      setPreviewUrl(undefined);
    }
    setPendingFile(file);
  }, []);

  return { pendingFile, previewUrl, replace };
}
