'use client';

import { useEffect } from 'react';
import { maximizeDesktopWindow } from '@/lib/native-shell';

/**
 * Maximizes the desktop shell's window on mount; nothing on the web or the
 * phone. Mounted by the screens drawn for a whole screen that a new admin walks
 * through in one go - sign-in and registration, then the setup wizard - so the
 * window opens out at the first of them and stays that way. Renders nothing.
 */
export function MaximizeDesktopWindow() {
  useEffect(() => {
    void maximizeDesktopWindow();
  }, []);
  return null;
}
