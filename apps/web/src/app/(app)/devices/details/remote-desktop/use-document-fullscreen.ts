'use client';

import { useEffect, useState } from 'react';

/**
 * Leaves fullscreen when the whole document is fullscreen, the remote desktop's own mode. An element another
 * page put in fullscreen (the recording player, the live session) is left alone. Never throws: a document that
 * already left fullscreen (Escape, a tab switch) is in the state this asks for.
 */
export function leaveDocumentFullscreen(): void {
  if (typeof document === 'undefined' || document.fullscreenElement !== document.documentElement) return;
  void document.exitFullscreen?.().catch(() => undefined);
}

/**
 * Whether the document is fullscreen, kept current from `fullscreenchange`. The remote desktop fullscreens the
 * whole document (not its own element) so the toolbar's dialogs, menus and toasts, which portal to `<body>`,
 * still show over the session. So leaving the page leaves fullscreen as well: otherwise the page it navigates to
 * (Back to Device Details, the browser's back) opens fullscreen, with nothing on it to leave.
 */
export function useDocumentFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      leaveDocumentFullscreen();
    };
  }, []);
  return isFullscreen;
}
