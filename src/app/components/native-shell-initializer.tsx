'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { initKeyboardInset } from '@/lib/keyboard-inset';
import { initNativeBack } from '@/lib/native-back';
import {
  hideSplashScreen,
  initNativeChrome,
  onNativeNotificationClick,
  takeNativeStartupNotificationClick,
} from '@/lib/native-shell';
import { isAppShell, isDesktopShell, isMobileShell, shellKind } from '@/lib/platform';
import { routes } from '@/lib/routes';
import { initTokenStore } from '@/lib/token-store';
import { resolveNatsNotificationRoute } from './notifications/notification-navigation';

// The shell event transport outlives React lifecycles — register the listener
// and drain the startup click exactly once per page, however many times the
// component (re)mounts.
let nativeClickHandlingInitialized = false;

/**
 * Per-shell startup, split by which shell actually owns each step:
 *
 * - Either shell: Keychain/Keystore -> memory token hydration, as early as
 *   possible so the first API calls can attach a bearer synchronously. Not a
 *   render gate — if a request wins the race, the normal 401 -> refresh -> retry
 *   path recovers (refresh awaits hydration).
 * - Mobile: status bar + safe-area insets, hardware back, splash hide.
 * - Desktop: OS-notification clicks forwarded by the Rust notification plane —
 *   the envelope context maps to the same route the in-app drawer would use,
 *   falling back to the notifications page.
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

    if (isMobileShell()) {
      // Status bar (overlay + light content) then safe-area insets. Kicked off
      // BEFORE the splash-hide chain below, so the insets are in flight while
      // hydration runs and the layout is already inset when the splash lifts.
      void initNativeChrome();
      // Android hardware/gesture back → overlay dismiss → SPA history → exit.
      initNativeBack();
    }

    // Hide the launch splash once hydration settles — so it also covers a
    // cold-start biometric unlock prompt (getTokens awaits it).
    void initTokenStore().finally(() => void hideSplashScreen());

    if (isDesktopShell() && !nativeClickHandlingInitialized) {
      nativeClickHandlingInitialized = true;
      const openNotification = (payload: unknown) => {
        router.push(resolveNatsNotificationRoute(payload) ?? routes.notifications());
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
  }, [router]);

  return null;
}
