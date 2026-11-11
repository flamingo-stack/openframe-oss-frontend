'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { markNotificationReadById } from '@/graphql/notifications/mark-notification-read-mutation';
import { primeShellVersion } from '@/lib/client-identity';
import { initKeyboardInset } from '@/lib/keyboard-inset';
import { initNativeBack } from '@/lib/native-back';
import {
  hideSplashScreen,
  initNativeChrome,
  onDesktopDownloadLink,
  onNativeNotificationClick,
  takeDesktopDownloadId,
  takeNativeStartupNotificationClick,
} from '@/lib/native-shell';
import { confirmBundleBooted } from '@/lib/native-update';
import { isAppShell, isDesktopShell, isMobileShell, shellKind } from '@/lib/platform';
import { storeDownloadId } from '@/lib/registration-attribution';
import { initTokenStore } from '@/lib/token-store';
import {
  followNotificationTap,
  resolveNatsNotificationAction,
  tappedNotificationId,
} from './notifications/notification-navigation';

// The shell event transport outlives React lifecycles — register the listener
// and drain the startup click exactly once per page, however many times the
// component (re)mounts.
let nativeClickHandlingInitialized = false;
// Same for the "Open the app" link's download id.
let downloadLinkHandlingInitialized = false;
// And for the report that this bundle booted (mobile's over-the-air updater).
let bundleBootConfirmed = false;

/**
 * Per-shell startup, split by which shell actually owns each step:
 *
 * - Either shell: Keychain/Keystore -> memory token hydration, as early as
 *   possible so the first API calls can attach a bearer synchronously. Not a
 *   render gate — if a request wins the race, the normal 401 -> refresh -> retry
 *   path recovers (refresh awaits hydration).
 * - Mobile: status bar + safe-area insets, hardware back, then the report that
 *   this bundle booted (`confirmBundleBooted`), splash hide.
 * - Desktop: OS-notification clicks forwarded by the Rust notification plane —
 *   the envelope's `type` + `attributes` resolve to the same action the in-app
 *   drawer would take (`followNotificationTap`): an announcement's link in the
 *   system browser, or in the app on the tenant's origin, read by the click's
 *   `notificationId`; else the route; else the notifications page. And the
 *   download id an "Open the app" link brought, stored for the signup
 *   (`registration-attribution.ts`).
 *
 * The keyboard inset also runs on the touch web; every other step below is a
 * no-op outside a shell.
 */
export function NativeShellInitializer() {
  const router = useRouter();

  useEffect(() => {
    // Above the shell gate on purpose: the keyboard inset has a visualViewport
    // path that a touch browser / PWA needs just as much as the shells do. It
    // picks its own signal and no-ops on desktop pointers.
    initKeyboardInset();

    if (!isAppShell()) return;
    // Scopes the shell-only CSS in globals.css. Carries the KIND, not a bare
    // flag: the safe-area rules it gates are a phone contract (insets, notch,
    // home indicator) and applied to the desktop window as well while this was
    // `data-native-shell`.
    document.documentElement.dataset.shell = shellKind();

    primeShellVersion();

    if (isMobileShell()) {
      // Status bar (overlay + light content) then safe-area insets. Kicked off
      // BEFORE the splash-hide chain below, so the insets are in flight while
      // hydration runs and the layout is already inset when the splash lifts.
      void initNativeChrome();
      // Android hardware/gesture back → overlay dismiss → SPA history → exit.
      initNativeBack();
      // After the two calls above: a release whose initNativeBack (or anything
      // earlier in this effect) throws synchronously does not report ready, and
      // the shell goes back to the bundle before. initNativeChrome is async, so a
      // failure in it is a dropped rejection and the bundle still reports ready.
      // Ahead of token hydration below: the shell counts the launches that never
      // report, and hydration can sit behind a Face ID prompt for as long as the
      // user leaves it there. Nothing in between awaits.
      if (!bundleBootConfirmed) {
        bundleBootConfirmed = true;
        void confirmBundleBooted();
      }
    }

    // Hide the launch splash once hydration settles — so it also covers a
    // cold-start biometric unlock prompt (getTokens awaits it).
    void initTokenStore().finally(() => void hideSplashScreen());

    if (isDesktopShell() && !nativeClickHandlingInitialized) {
      nativeClickHandlingInitialized = true;
      const openNotification = (payload: unknown) => {
        const notificationId = tappedNotificationId(payload);
        followNotificationTap(resolveNatsNotificationAction(payload), {
          navigate: route => router.push(route),
          markRead: () => {
            if (notificationId) markNotificationReadById(notificationId);
          },
        });
      };
      void (async () => {
        let registered: boolean;
        try {
          registered = await onNativeNotificationClick(openNotification);
        } catch (error) {
          // Registration is the only step worth retrying: the shell's gate is
          // still shut, so clicks park rather than vanish, and no listener
          // exists yet for a remount to duplicate.
          nativeClickHandlingInitialized = false;
          console.error('[Native Shell] notification click listener failed:', error);
          return;
        }
        // No transport — a desktop binary that predates the notification plane.
        // Leave the flag set: that is permanent for this document, so a remount
        // would only repeat the no-op.
        if (!registered) return;
        // Strictly after a live listener: draining also opens the shell's gate,
        // after which it emits instead of parking.
        const payload = await takeNativeStartupNotificationClick();
        try {
          if (payload) openNotification(payload);
        } catch (error) {
          // Deliberately does not reset the flag — the listener is live, and a
          // remount would stack a second one.
          console.error('[Native Shell] startup notification route failed:', error);
        }
      })();
    }

    if (isDesktopShell() && !downloadLinkHandlingInitialized) {
      downloadLinkHandlingInitialized = true;
      const takeDownloadId = () =>
        void takeDesktopDownloadId().then(id => {
          if (id) storeDownloadId(id);
        });
      void (async () => {
        try {
          await onDesktopDownloadLink(takeDownloadId);
        } catch (error) {
          console.error('[Native Shell] download link listener failed:', error);
        }
        // After the listener, so a link that lands in between is taken by one of the two: a link
        // that started the app is already waiting, one that arrives later signals.
        takeDownloadId();
      })();
    }
  }, [router]);

  return null;
}
