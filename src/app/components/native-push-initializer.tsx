'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { initNativePush } from '@/lib/native-push';
import { isMobileShell } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { resolvePushNotificationRoute } from './notifications/notification-navigation';
import { useSubscriptionOpen } from './subscription-lock/subscription-guard';

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
  // `registerPushDevice` is a mutation, so it bypasses the subscription gate —
  // see `useSubscriptionOpen`. A locked workspace registers nothing: the
  // registration would fail, and there is no notification to deliver behind a
  // lock screen anyway. `initNativePush` latches, so waiting for the answer
  // costs nothing but the round-trip.
  const subscriptionOpen = useSubscriptionOpen();

  useEffect(() => {
    if (!isMobileShell() || !subscriptionOpen) return;
    initNativePush(data => {
      router.push(resolvePushNotificationRoute(data) ?? routes.notifications());
    }).catch(error => {
      // `initialized` latches before the awaits inside, so this is terminal for the
      // session: no token registration, possibly no tap handler. Surface it rather
      // than leaving an unhandled rejection as the only trace.
      console.error('[Native Push] initialisation failed:', error);
    });
  }, [router, subscriptionOpen]);

  return null;
}
