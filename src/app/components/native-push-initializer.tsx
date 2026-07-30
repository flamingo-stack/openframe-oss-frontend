'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { initNativePush } from '@/lib/native-push';
import { isMobileShell } from '@/lib/platform';

/**
 * Mounted once the user is authenticated (app-layout): asks for notification
 * permission, obtains the FCM registration token, and deep-links notification
 * taps through the client router. Renders nothing; no-ops outside the native shell.
 */
export function NativePushInitializer() {
  const router = useRouter();

  useEffect(() => {
    if (!isMobileShell()) return;
    void initNativePush(route => router.push(route));
  }, [router]);

  return null;
}
