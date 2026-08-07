/**
 * Which shell is hosting this bundle. The only module that reads the injected
 * globals to IDENTIFY the shell — `native-shell.ts` reads them too, but only to
 * reach an already-identified shell's bridge. Everything else asks the
 * predicates here, which is what keeps the distinctions below enforceable.
 *
 * The same static export runs in three places, and "native" is not one thing:
 *
 *   - `isAppShell()`  — either shell. Shell-custodied tokens (Keychain /
 *     Keystore, bearer-only), no Next server behind the page origin so no
 *     `/content` rewrite, in-app auth pages, no external navigation, and the
 *     App Store / Play billing ban.
 *   - `isMobileShell()` — the phone. FCM push, biometric login, status bar /
 *     splash / safe-area insets, Android hardware back, and the custom-scheme
 *     OAuth callback (desktop lands on https instead).
 *   - `isDesktopShell()` — Tauri. Shell-side token rotation and OS-notification
 *     click transports, both delivered as Tauri events.
 *
 * Reaching for `isAppShell()` when the feature is phone-only is the mistake this
 * split exists to prevent: it silently included every desktop install.
 */

export type ShellKind = 'web' | 'mobile' | 'desktop';

let cachedShellKind: ShellKind | null = null;

function detectShellKind(): ShellKind {
  const globals = window as any;
  // Each shell is identified by a global only it has: Tauri's IPC object on
  // desktop, Capacitor's native bridge on mobile. Disjoint, so the order below
  // isn't load-bearing — but Tauri stays first deliberately. The desktop shell
  // used to inject a Capacitor-SHAPED auth bridge (an `isNativePlatform()`
  // returning true over Tauri commands) back when one "is this native?" check
  // had to cover both shells, and while that existed this ordering was the only
  // thing keeping every desktop install from reading as mobile. Probing Tauri
  // first means a shim like that reappearing can't silently re-break the split.
  //
  // Both Tauri globals are checked because only `__TAURI_INTERNALS__` is
  // unconditional; `__TAURI__` depends on the shell's `withGlobalTauri` (on
  // today, and what the notification/token event listeners use).
  if (globals.__TAURI_INTERNALS__ || globals.__TAURI__) return 'desktop';
  if (globals.Capacitor?.isNativePlatform?.() === true) return 'mobile';
  return 'web';
}

/**
 * Both shells install their globals before any page script runs (Tauri's
 * `initialization_script`, Capacitor's document-start user script), so this is
 * safe to read at module-evaluation time — `CONTENT_ORIGIN` does exactly that.
 *
 * Memoized: a document cannot change shell mid-session. Never memoized during
 * SSR, where the answer is 'web' by definition and module state is shared
 * across requests.
 */
export function shellKind(): ShellKind {
  if (typeof window === 'undefined') return 'web';
  cachedShellKind ??= detectShellKind();
  return cachedShellKind;
}

/** In a native shell (mobile OR desktop) rather than a browser. */
export function isAppShell(): boolean {
  return shellKind() !== 'web';
}

/** The Capacitor shell on iOS/Android. False on desktop, which is not a phone. */
export function isMobileShell(): boolean {
  return shellKind() === 'mobile';
}

/** The Tauri desktop shell. */
export function isDesktopShell(): boolean {
  return shellKind() === 'desktop';
}

/** The phone OS; null everywhere else — on the web AND on desktop. */
export function mobilePlatform(): 'ios' | 'android' | null {
  if (!isMobileShell()) return null;
  const platform = (window as any).Capacitor?.getPlatform?.();
  return platform === 'ios' || platform === 'android' ? platform : null;
}

/**
 * Running on an Apple device — the iOS Capacitor shell, the desktop shell on
 * macOS, or a browser on iOS/iPadOS/macOS. Gates Apple-only auth surfaces (the
 * "Continue with Apple" button). UA sniffing is the only non-Capacitor signal;
 * iPadOS Safari reports "Macintosh", which still lands in the allowed set.
 */
export function isApplePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMobileShell()) return mobilePlatform() === 'ios';
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
}
