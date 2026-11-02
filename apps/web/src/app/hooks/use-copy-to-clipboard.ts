'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardOptions {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  resetDelay?: number;
}

export function useCopyToClipboard({
  successTitle = 'Copied',
  successDescription = 'Copied to clipboard',
  errorTitle = 'Copy failed',
  errorDescription = 'Could not copy to clipboard',
  resetDelay = 2000,
}: UseCopyToClipboardOptions = {}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  /** The pending reset of `copied`: replaced by the next copy, cleared when the component goes. */
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once the component is gone, so a copy the clipboard answers after that updates nothing. */
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: successTitle, description: successDescription, variant: 'success' });
        // The copy landed either way; the toast is global. The state belongs to a component that may
        // have gone while the clipboard answered, and a timer scheduled now would outlive its cleanup.
        if (unmounted.current) return;
        setCopied(true);
        if (resetTimer.current !== null) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          resetTimer.current = null;
          if (!unmounted.current) setCopied(false);
        }, resetDelay);
      } catch {
        toast({ title: errorTitle, description: errorDescription, variant: 'destructive' });
      }
    },
    [successTitle, successDescription, errorTitle, errorDescription, resetDelay, toast],
  );

  return { copy, copied };
}
