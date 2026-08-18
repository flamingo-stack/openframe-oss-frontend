'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { initNativePush } from '@/lib/native-push';
import { isMobileShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { resolvePushNotificationRoute } from './notifications/notification-navigation';

/**
 * Mounted once the user is authenticated (app-layout): asks for notification
 * permission, obtains the FCM registration token, and deep-links notification
 * taps through the client router. Renders nothing; no-ops outside the native shell.
 *
 * The route comes from the payload's context type + entity ids, resolved by the
 * same table the in-app drawer uses — the push payload carries no route, so the
 * backend stays ignorant of the frontend's URL structure (which it could not
 * know anyway: detail pages are query params on prerendered paths, and a Mingo
 * dialog may have no URL at all). A notification whose type this build does not
 * recognise still lands somewhere useful: the notifications page.
 */
export function NativePushInitializer() {
  const router = useRouter();

  useEffect(() => {
    if (!isMobileShell()) return;
    void initNativePush(data => {
      router.push(resolvePushNotificationRoute(data) ?? routes.notifications());
    });
  }, [router]);

  return null;
}
