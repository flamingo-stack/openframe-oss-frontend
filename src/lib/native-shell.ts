/**
 * Typed access to the native shells' bridges. Each shell exposes its own:
 * `window.Capacitor.Plugins` on mobile (openframe-mobile IS Capacitor; this web
 * app deliberately has no Capacitor npm dependency, so all access goes through
 * these helpers) and `window.__OPENFRAME_SHELL__` on desktop (Tauri commands).
 *
 * Which shell we're in is `platform.ts`'s job. Every accessor here is gated on
 * the axis that actually owns the plugin: `isMobileShell()` for the phone-only
 * plugins, `isDesktopShell()` for the Tauri event transports, both for the
 * shared auth bridge.
 */

import { isAppShell, isDesktopShell, isMobileShell } from './platform';

/**
 * Custom URL scheme the mobile app registers (CFBundleURLTypes). The login
 * ASWebAuthenticationSession completes when navigation hits it; the gateway
 * 302s the devTicket straight to it for authMobile=true logins.
 */
export const MOBILE_APP_SCHEME = 'com.openframe.app';

/** Biometry the device supports; `'none'` when biometric auth is unavailable. */
export type BiometryType = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'none';

/**
 * The auth bridge contract, implemented by BOTH shells. The five methods above
 * `refreshTokens` are the shared core; everything optional below is
 * shell-specific — the doc on each says which shell means it, and callers must
 * probe (`plugin.foo?.()`) rather than assume. Mobile-only methods are also
 * `isMobileShell()`-gated at their call sites; the optionality here is what
 * keeps a live-reload bundle safe against an older installed mobile binary.
 */
export interface NativeAuthPlugin {
  /**
   * Runs the OAuth login in a shell-owned browser context and resolves with
   * the final callback URL. Mobile shells run a system browser
   * (ASWebAuthenticationSession) that completes on `callbackScheme`; the
   * desktop shell runs a dedicated window that intercepts the https
   * callbackHost/callbackPath landing and ignores `callbackScheme`.
   */
  start(options: {
    url: string;
    callbackHost: string;
    callbackPath: string;
    callbackScheme?: string;
  }): Promise<{ callbackUrl: string }>;
  /** Performs the dev-ticket exchange over native HTTP (no CORS) and returns tokens from response headers. */
  exchangeTicket(options: { url: string }): Promise<{ accessToken?: string; refreshToken?: string }>;
  /**
   * Native Sign in with Apple (ASAuthorizationController) — iOS-only, and
   * absent on binaries that predate it; callers must feature-check and fall
   * back to `start`. `nonce` is the SHA-256 hex of the raw nonce the JS side
   * generated (Apple embeds it into the identity token's `nonce` claim).
   * Rejects with USER_CANCELED when the user dismisses the sheet.
   */
  signInWithApple?(options: { nonce: string }): Promise<{
    identityToken: string;
    authorizationCode: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  /**
   * POSTs the Apple credential to the gateway's native-exchange endpoint over
   * native HTTP (same no-CORS rationale as exchangeTicket) and returns tokens
   * from the Access-Token / Refresh-Token response headers. Paired with
   * `signInWithApple`; same availability caveat.
   */
  exchangeApple?(options: {
    url: string;
    body: Record<string, string>;
  }): Promise<{ accessToken?: string; refreshToken?: string }>;
  /**
   * Reads the stored tokens. When biometric login is enabled the shell gates
   * this behind a biometric prompt, so it may reject with `BIOMETRIC_CANCELED`
   * (user dismissed the prompt) or `BIOMETRIC_INVALIDATED` (enrollment changed —
   * the token is no longer decryptable). See native-biometrics.ts for handling.
   */
  getTokens(): Promise<{ accessToken?: string; refreshToken?: string }>;
  setTokens(options: { accessToken?: string; refreshToken?: string }): Promise<void>;
  clearTokens(): Promise<void>;
  /**
   * Biometric login — MOBILE-only, and absent on mobile binaries that predate
   * the biometric effort. Access through native-biometrics.ts, which guards for
   * both.
   */
  isBiometricAvailable?(): Promise<{ available: boolean; biometryType: BiometryType }>;
  isBiometricLoginEnabled?(): Promise<{ enabled: boolean }>;
  /** Rejects: BIOMETRIC_UNAVAILABLE | NO_TOKENS | BIOMETRIC_CANCELED. */
  enableBiometricLogin?(): Promise<void>;
  /** Rejects: BIOMETRIC_CANCELED. */
  disableBiometricLogin?(): Promise<void>;
  /**
   * Shell-owned refresh (single-flight in the shell). Optional — shells that
   * implement it become the ONLY refresher: refresh tokens rotate, so the
   * webview must not race a shell-side refresher with its own /oauth/refresh.
   * Resolves with the stored tokens after the attempt (empty = session over);
   * rejects on transient failure. Implemented by the desktop (Tauri) shell;
   * the mobile Swift plugin not yet.
   */
  refreshTokens?(): Promise<{ accessToken?: string; refreshToken?: string }>;
  /**
   * Persist the login-learned tenant host in the shell, so shell-side
   * networking (token refresh, background NATS) has a gateway without
   * depending on webview localStorage. Optional, desktop-only for now.
   */
  setTenantHost?(options: { origin: string }): Promise<void>;
  /**
   * Real safe-area insets from UIKit / WindowInsets — the WebView reports
   * env(safe-area-inset-*) as 0 in the shell. MOBILE-only: the desktop bridge
   * used to answer it with a zeros stub purely to satisfy this interface, and
   * doesn't implement it at all now that nothing off-mobile asks.
   */
  getSafeAreaInsets?(): Promise<{ top: number; bottom: number; left: number; right: number }>;
}

export type PushPermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

/** Subset of @capacitor-firebase/messaging used by this app (plugin ships with the shell, not npm). */
export interface FirebaseMessagingPlugin {
  checkPermissions(): Promise<{ receive: PushPermissionState }>;
  requestPermissions(): Promise<{ receive: PushPermissionState }>;
  /** Registers with APNs/FCM and resolves the FCM registration token (both platforms). */
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  /** Fires when FCM first issues or later rotates the registration token. */
  addListener(eventName: 'tokenReceived', listenerFunc: (event: { token: string }) => void): Promise<unknown>;
  addListener(
    eventName: 'notificationActionPerformed',
    listenerFunc: (event: { notification: { data?: Record<string, unknown> } }) => void,
  ): Promise<unknown>;
}

/** A picked file as the NativeFiles plugin returns it, before `mimeType` is normalized to `type`. */
export interface NativePickedFilePayload {
  path: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Subset of the shell's local NativeFiles plugin (openframe-mobile:
 * NativeFilesPlugin.swift / NativeFilesPlugin.java; ships with the shell, not
 * npm). Attachment bytes move through here instead of the WebView — native-files.ts
 * owns the reasons and is the only module that should call these.
 */
export interface NativeFilesPlugin {
  /** Resolves with an empty array when the user cancels. */
  pickFiles(options: { multiple?: boolean }): Promise<{ files: NativePickedFilePayload[] }>;
  /** Streams a picked file to a presigned URL; rejects on a non-2xx status. */
  uploadFile(options: { path: string; url: string; contentType?: string }): Promise<{ status: number }>;
  /**
   * Fetches natively, then saves (Android Downloads) or shares (iOS, and Android
   * below API 29) the result. `savedToDownloads` distinguishes the two: a share
   * sheet is its own confirmation, a silent save is not, and the caller has to
   * say so itself.
   */
  downloadFile(options: { url: string; fileName: string }): Promise<{ savedToDownloads: boolean }>;
}

/** Subset of @capacitor/splash-screen (plugin ships with the shell, not npm). */
export interface SplashScreenPlugin {
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
  show(options?: { autoHide?: boolean }): Promise<void>;
}

/**
 * Subset of @capacitor/status-bar. Enum naming is counterintuitive: `'DARK'` =
 * light text/icons (for a dark status-bar background), `'LIGHT'` = dark text.
 */
export interface StatusBarPlugin {
  setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
  setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
}

/**
 * Subset of @capacitor/app. `backButton` is Android-only (hardware/gesture back);
 * iOS has no hardware back and uses the WKWebView edge-swipe instead.
 *
 * addListener's return is typed as a union on purpose: the natively-injected
 * bridge proxy hands back the handle synchronously, not the Promise the npm
 * plugin types advertise. Normalize with Promise.resolve() before chaining —
 * calling .catch/.then on it directly crashes at boot on a sync bridge.
 */
export interface AppPlugin {
  addListener(
    eventName: 'backButton',
    listenerFunc: (event: { canGoBack?: boolean }) => void,
  ): Promise<{ remove: () => void }> | { remove: () => void };
  exitApp(): Promise<void>;
}

/**
 * Subset of @capacitor/keyboard. `keyboardHeight` is CSS px on both platforms:
 * iOS reports the keyboard frame in points, and the Android plugin divides the
 * `WindowInsets.Type.ime()` inset by display density before emitting.
 *
 * The shell configures `resize: 'none'`, so these events are the only notice
 * the web layer gets that a keyboard exists — see keyboard-inset.ts. Same
 * sync-or-Promise addListener return as AppPlugin.
 */
export interface KeyboardPlugin {
  addListener(
    eventName: 'keyboardWillShow',
    listenerFunc: (info: { keyboardHeight: number }) => void,
  ): Promise<{ remove: () => void }> | { remove: () => void };
  /** Hide carries no payload — iOS notifies with nil, Android with an empty object. */
  addListener(
    eventName: 'keyboardWillHide',
    listenerFunc: () => void,
  ): Promise<{ remove: () => void }> | { remove: () => void };
}

function capacitorPlugins(): any {
  return typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins : undefined;
}

/** The desktop shell's own namespace — Tauri commands, no Capacitor involved. */
function desktopShellBridge(): any {
  return typeof window !== 'undefined' ? (window as any).__OPENFRAME_SHELL__ : undefined;
}

/**
 * The shared auth bridge: one interface, two implementations — mobile in
 * Swift/Java behind the real Capacitor bridge, desktop in Rust behind
 * `__OPENFRAME_SHELL__`. Dispatch on the shell rather than on which global
 * happens to exist; the desktop used to inject a fake `window.Capacitor` so a
 * single lookup could serve both, which is exactly the conflation the platform
 * split removed.
 */
export function nativeAuthPlugin(): NativeAuthPlugin | null {
  if (isDesktopShell()) return desktopShellBridge()?.nativeAuth ?? null;
  if (isMobileShell()) return capacitorPlugins()?.NativeAuth ?? null;
  return null;
}

/** Mobile-only. Also null until @capacitor-firebase/messaging is present in the shell — callers no-op. */
export function firebaseMessagingPlugin(): FirebaseMessagingPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.FirebaseMessaging ?? null) : null;
}

/** Mobile-only. Also null on shell binaries that predate the NativeFiles plugin — callers fall back to the web path. */
export function nativeFilesPlugin(): NativeFilesPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.NativeFiles ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/splash-screen is present in the shell — callers no-op. */
export function splashScreenPlugin(): SplashScreenPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.SplashScreen ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/status-bar is present in the shell — callers no-op. */
export function statusBarPlugin(): StatusBarPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.StatusBar ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/app is present in the shell — callers no-op. */
export function appPlugin(): AppPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.App ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/keyboard is present in the shell — callers fall back to visualViewport. */
export function keyboardPlugin(): KeyboardPlugin | null {
  return isMobileShell() ? (capacitorPlugins()?.Keyboard ?? null) : null;
}

const TENANT_HOST_STORAGE_KEY = 'native:tenant-host-url';

/**
 * Tenant host the shell learned at login time: the OAuth callback lands on the
 * tenant's canonical host (resolved server-side from the tenant registry), so
 * one binary can serve any tenant without a build-time
 * NEXT_PUBLIC_TENANT_HOST_URL. localStorage survives shell restarts and is
 * synchronous, so the value is available to module-load-time readers.
 */
export function getStoredTenantHost(): string | null {
  if (!isAppShell()) return null;
  try {
    return window.localStorage.getItem(TENANT_HOST_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeTenantHost(origin: string): void {
  if (!isAppShell() || !origin) return;
  try {
    window.localStorage.setItem(TENANT_HOST_STORAGE_KEY, origin);
  } catch {
    // Best-effort: the next login learns the host again.
  }
}

/**
 * Subscribe to shell-pushed token rotations. The desktop shell refreshes
 * tokens on its own schedule (the webview may be idle) and emits the full
 * token set after every change — including an empty set when the session is
 * over. Desktop-only transport; no-op on mobile and the web.
 */
export function onNativeTokenUpdate(callback: (tokens: { accessToken?: string; refreshToken?: string }) => void): void {
  if (!isDesktopShell()) return;
  const tauriEvent = (window as any).__TAURI__?.event;
  if (typeof tauriEvent?.listen !== 'function') return;
  void tauriEvent.listen('native-auth:token-update', (event: any) => callback(event?.payload ?? {}));
}

/**
 * Subscribe to OS-notification clicks forwarded by the desktop shell's Rust
 * notification plane. The payload carries the notification envelope's
 * `context` — resolve a route with resolveNatsNotificationRoute. Desktop-only
 * transport; mobile deep-links notification taps through FCM instead
 * (native-push.ts).
 *
 * Resolves `true` only once a listener is actually live. Callers must not open
 * the shell's click gate (takeNativeStartupNotificationClick) otherwise: the
 * gate makes the shell emit instead of parking, so opening it with nothing
 * listening drops every later click.
 */
export async function onNativeNotificationClick(callback: (payload: unknown) => void): Promise<boolean> {
  if (!isDesktopShell()) return false;
  const tauriEvent = (window as any).__TAURI__?.event;
  if (typeof tauriEvent?.listen !== 'function') return false;
  await tauriEvent.listen('notification:click', (event: any) => callback(event?.payload));
  return true;
}

/**
 * Signal the desktop shell that the notification:click listener is mounted,
 * and drain the click that happened before it existed — a click that
 * cold-starts the app fires while the OS is still launching us, long before
 * React runs. The shell parks that payload until this call and emits directly
 * from then on, so it must run exactly once, after onNativeNotificationClick
 * has resolved. Resolves null when nothing was parked.
 */
export async function takeNativeStartupNotificationClick(): Promise<unknown> {
  if (!isDesktopShell()) return null;
  const invoke = (window as any).__TAURI__?.core?.invoke;
  if (typeof invoke !== 'function') return null;
  try {
    return await invoke('take_pending_notification_click');
  } catch (error) {
    // The command itself cannot fail — it returns an Option, not a Result — so
    // a rejection means it never ran: an older shell that lacks it, or a
    // capability that does not grant it. Either way the gate stayed shut and
    // clicks are still parked, so null is the safe answer. Log it rather than
    // discard it: silently reporting "nothing parked" would hide a
    // misconfiguration that costs every startup-click for the session.
    console.error('[Native Shell] take_pending_notification_click failed:', error);
    return null;
  }
}

/**
 * Publish the native safe-area insets as CSS variables consumed by the
 * mobile-scoped rules in globals.css
 * (`--native-safe-top/-bottom/-left/-right`). All four are set so landscape and
 * notch/home-indicator edges are honored, not just the portrait status bar.
 *
 * Mobile-only: a notch/home-indicator inset is a phone concept, and the desktop
 * shell only answers this call with a zeros stub.
 */
export async function applyNativeSafeAreas(): Promise<void> {
  if (!isMobileShell()) return;
  try {
    const insets = await nativeAuthPlugin()?.getSafeAreaInsets?.();
    if (!insets) return;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--native-safe-top', `${insets.top}px`);
    rootStyle.setProperty('--native-safe-bottom', `${insets.bottom}px`);
    rootStyle.setProperty('--native-safe-left', `${insets.left}px`);
    rootStyle.setProperty('--native-safe-right', `${insets.right}px`);
  } catch (error) {
    console.warn('[Native Shell] safe-area inset lookup failed:', error);
  }
}

/**
 * Hide the launch splash once the shell is interactive. The splash is configured
 * launchAutoHide:false, so nothing hides it until this runs — call it after token
 * hydration settles so it also covers a cold-start biometric unlock prompt.
 * No-op off mobile / in shells without the plugin.
 */
export async function hideSplashScreen(): Promise<void> {
  try {
    await splashScreenPlugin()?.hide({ fadeOutDuration: 200 });
  } catch (error) {
    console.warn('[Native Shell] splash hide failed:', error);
  }
}

/**
 * Configure the status bar for the dark app chrome: overlay the WebView (so the
 * viewport-fit=cover content + the opaque --native-safe-top band draw under it)
 * with light content legible on that band. No-op off mobile / in shells without
 * the plugin.
 */
export async function initNativeStatusBar(): Promise<void> {
  const statusBar = statusBarPlugin();
  if (!statusBar) return;
  try {
    await statusBar.setOverlaysWebView({ overlay: true });
    await statusBar.setStyle({ style: 'DARK' });
  } catch (error) {
    console.warn('[Native Shell] status bar setup failed:', error);
  }
}

// The insets change on rotation; register the refresh listener once however
// many times initNativeChrome is invoked (React strict-mode / remounts).
let safeAreaRefreshHooked = false;

/**
 * Mobile launch chrome, run once on shell startup: set the status bar to overlay
 * with light content, THEN publish the safe-area insets (on Android the top inset
 * only becomes the status-bar height once the bar overlays the WebView).
 */
export async function initNativeChrome(): Promise<void> {
  await initNativeStatusBar();
  await applyNativeSafeAreas();
  if (!safeAreaRefreshHooked) {
    safeAreaRefreshHooked = true;
    // Rotation resizes the WebView and swaps which edges carry insets. iOS can
    // still report the pre-rotation safeAreaInsets in the same frame as the
    // resize event, so take a trailing read once the transition settles.
    window.addEventListener('resize', () => {
      void applyNativeSafeAreas();
      window.setTimeout(() => void applyNativeSafeAreas(), 350);
    });
  }
}
