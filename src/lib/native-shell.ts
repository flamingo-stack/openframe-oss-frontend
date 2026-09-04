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
 * Custom URL scheme both native shells complete their login on: the gateway
 * 302s the devTicket straight to it for authMobile=true logins, and it is the
 * one redirect target the gateway honours verbatim in every environment
 * (`openframe.gateway.redirect.allowed-uris`). Mobile registers it with the OS
 * (CFBundleURLTypes / intent-filter) because its ASWebAuthenticationSession
 * matches on it; the desktop shell never hands it to the OS — it cancels the
 * navigation inside its own login window — so it registers nothing.
 */
export const APP_SCHEME = 'com.openframe.app';

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
   * the final callback URL. Both shells end the flow on `callbackScheme`:
   * mobile runs a system browser (ASWebAuthenticationSession) that matches on
   * it, desktop runs a dedicated window that cancels the navigation to it.
   * Desktop additionally resolves on ANY callback carrying a `devTicket`, which
   * is what an environment that drops the requested redirect still produces.
   */
  start(options: { url: string; callbackScheme: string }): Promise<{ callbackUrl: string }>;
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
  exchangeApple?(options: { url: string; body: Record<string, string> }): Promise<{
    /**
     * Present on shells that resolve every HTTP status instead of rejecting non-2xx. Absent on
     * older binaries, where a 4xx arrives as a rejection — callers must treat `undefined` as
     * "this shell cannot report status" and fall back rather than assume success.
     */
    status?: number;
    /** Raw response body, when the server sent one. JSON for the `{"error": …}` cases. */
    body?: string;
    accessToken?: string;
    refreshToken?: string;
  }>;
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

/** A notification sitting in the OS tray, as the plugin reports it. */
export interface DeliveredNotification {
  id?: string;
  data?: Record<string, unknown>;
}

/** Subset of @capacitor-firebase/messaging used by this app (plugin ships with the shell, not npm). */
export interface FirebaseMessagingPlugin {
  checkPermissions(): Promise<{ receive: PushPermissionState }>;
  requestPermissions(): Promise<{ receive: PushPermissionState }>;
  /** Registers with APNs/FCM and resolves the FCM registration token (both platforms). */
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  /** Fires when FCM first issues or later rotates the registration token. */
  addListener(eventName: 'tokenReceived', listenerFunc: (event: { token: string }) => void): Promise<unknown>;
  /**
   * `notificationActionPerformed` fires on a tap; `notificationReceived` fires for a
   * push that arrives while the app is alive, including the data-only retraction push,
   * which carries no notification block and so renders nothing — it exists purely to
   * tell the client to clear a banner. One signature because this subset models only
   * `notification.data`, which both carry identically; split them if the tap event's
   * `actionId`/`inputValue` are ever needed.
   */
  addListener(
    eventName: 'notificationActionPerformed' | 'notificationReceived',
    listenerFunc: (event: { notification: { data?: Record<string, unknown> } }) => void,
  ): Promise<unknown>;
  getDeliveredNotifications(): Promise<{ notifications: DeliveredNotification[] }>;
  /** Takes the objects `getDeliveredNotifications` returned, not ids. */
  removeDeliveredNotifications(options: { notifications: DeliveredNotification[] }): Promise<void>;
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
  /**
   * Foreground/background transitions. The WebView's own `visibilitychange` is
   * unreliable for this on iOS — WKWebView does not consistently flip
   * `visibilityState` when the app is backgrounded — so anything that must run
   * on resume listens here instead.
   */
  addListener(
    eventName: 'appStateChange',
    listenerFunc: (state: { isActive: boolean }) => void,
  ): Promise<{ remove: () => void }> | { remove: () => void };
  exitApp(): Promise<void>;
}

/**
 * Subset of @capacitor/keyboard. `keyboardHeight` is CSS px on both platforms:
 * iOS reports the keyboard frame in points, and the Android plugin divides the
 * `WindowInsets.Type.ime()` inset by display density before emitting.
 *
 * Consumed on iOS ONLY: the shell configures `resize: 'none'` (an iOS-only
 * knob), so there these events are the only notice the web layer gets that a
 * keyboard exists, while on Android Capacitor's own SystemBars plugin resizes
 * the WebView and the layout viewport reports it — see keyboard-inset.ts. Same
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

/**
 * Subset of @capacitor/network, used because `navigator.onLine` in WKWebView lags
 * the OS by up to minutes — see `lib/connectivity.ts` for the device
 * measurements and why that matters to react-query.
 *
 * Same sync-or-Promise `addListener` union as `AppPlugin`/`KeyboardPlugin`, and
 * for the same reason: this reads `window.Capacitor.Plugins.Network`, the
 * document-start bridge shim, NOT the npm package's `registerPlugin` proxy whose
 * types promise a Promise. The shim hands the handle back synchronously.
 * Normalize with `Promise.resolve()` before chaining.
 *
 * Payload fields are optional because they arrive from that bridge untyped.
 */
export interface NetworkPlugin {
  getStatus(): Promise<{ connected?: boolean; connectionType?: string }>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: { connected?: boolean; connectionType?: string }) => void,
  ): Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
}

/**
 * What the two shells inject onto `window`. Nothing here is guaranteed to exist:
 * the web bundle has none of it, and a shell binary that predates a plugin has
 * only some. Each accessor below narrows its own entry to the interface it
 * declares — this module is the one place where a bridge value is asserted, and
 * that is what makes every consumer of it typed.
 */
interface TauriEventApi {
  listen(event: string, handler: (event: { payload?: unknown }) => void): Promise<unknown>;
}

interface TauriCoreApi {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
}

interface ShellWindow {
  Capacitor?: { Plugins?: Record<string, unknown> };
  __OPENFRAME_SHELL__?: { nativeAuth?: unknown };
  __TAURI__?: { event?: TauriEventApi; core?: TauriCoreApi };
}

function shellWindow(): ShellWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as ShellWindow);
}

function capacitorPlugins(): Record<string, unknown> | undefined {
  return shellWindow()?.Capacitor?.Plugins;
}

/** The desktop shell's own namespace — Tauri commands, no Capacitor involved. */
function desktopShellBridge(): ShellWindow['__OPENFRAME_SHELL__'] {
  return shellWindow()?.__OPENFRAME_SHELL__;
}

function tauriEventApi(): TauriEventApi | undefined {
  const api = shellWindow()?.__TAURI__?.event;
  return typeof api?.listen === 'function' ? api : undefined;
}

function tauriInvoke(): TauriCoreApi['invoke'] | undefined {
  const invoke = shellWindow()?.__TAURI__?.core?.invoke;
  return typeof invoke === 'function' ? invoke : undefined;
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
  if (isDesktopShell()) return (desktopShellBridge()?.nativeAuth as NativeAuthPlugin | undefined) ?? null;
  if (isMobileShell()) return (capacitorPlugins()?.NativeAuth as NativeAuthPlugin | undefined) ?? null;
  return null;
}

/** Mobile-only. Also null until @capacitor-firebase/messaging is present in the shell — callers no-op. */
export function firebaseMessagingPlugin(): FirebaseMessagingPlugin | null {
  return isMobileShell()
    ? ((capacitorPlugins()?.FirebaseMessaging as FirebaseMessagingPlugin | undefined) ?? null)
    : null;
}

/** Mobile-only. Also null on shell binaries that predate the NativeFiles plugin — callers fall back to the web path. */
export function nativeFilesPlugin(): NativeFilesPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.NativeFiles as NativeFilesPlugin | undefined) ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/splash-screen is present in the shell — callers no-op. */
export function splashScreenPlugin(): SplashScreenPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.SplashScreen as SplashScreenPlugin | undefined) ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/status-bar is present in the shell — callers no-op. */
export function statusBarPlugin(): StatusBarPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.StatusBar as StatusBarPlugin | undefined) ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/app is present in the shell — callers no-op. */
export function appPlugin(): AppPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.App as AppPlugin | undefined) ?? null) : null;
}

/** Mobile-only. Also null until @capacitor/keyboard is present in the shell — callers fall back to visualViewport. */
export function keyboardPlugin(): KeyboardPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.Keyboard as KeyboardPlugin | undefined) ?? null) : null;
}

/** Mobile-only. Also null on shell binaries that predate the plugin — callers fall back to `navigator.onLine`. */
export function networkPlugin(): NetworkPlugin | null {
  return isMobileShell() ? ((capacitorPlugins()?.Network as NetworkPlugin | undefined) ?? null) : null;
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
  const tauriEvent = tauriEventApi();
  if (!tauriEvent) return;
  void tauriEvent.listen('native-auth:token-update', event =>
    callback((event?.payload as { accessToken?: string; refreshToken?: string } | undefined) ?? {}),
  );
}

/**
 * Subscribe to OS-notification clicks forwarded by the desktop shell's Rust
 * notification plane. Resolve a route from the payload with
 * resolveNatsNotificationRoute, which reads the envelope's `type`/`attributes`
 * when the shell forwards them and its legacy `context` otherwise. Desktop-only
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
  const tauriEvent = tauriEventApi();
  if (!tauriEvent) return false;
  await tauriEvent.listen('notification:click', event => callback(event?.payload));
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
  const invoke = tauriInvoke();
  if (!invoke) return null;
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
 * An update the shell is offering. `releaseNotesUrl` is stamped into the
 * updater manifest by the desktop release workflow and is absent on manifests
 * published before that page existed — callers hide the link rather than
 * linking a 404.
 */
export interface DesktopUpdateAvailability {
  available: boolean;
  version?: string | null;
  notes?: string | null;
  releaseNotesUrl?: string | null;
}

/**
 * Why an update failed, classified SHELL-side (updater.rs `classify`). The
 * plugin's error strings are not an interface — they wrap upstream errors and
 * change between releases — so the kind is what the UI switches on and
 * `message` is only ever for the log.
 *
 * - `network` — could not reach the update server (retry)
 * - `signature` — the download failed verification (retry, then reinstall)
 * - `io` — could not write to disk (free space, retry)
 * - `unavailable` — no artifact for this platform, or a malformed manifest
 * - `busy` — an apply is already running; this call owns nothing
 * - `gone` — no longer offered; the silent startup update already took it
 * - `unknown` — anything else
 */
export type DesktopUpdateErrorKind = 'network' | 'signature' | 'io' | 'unavailable' | 'busy' | 'gone' | 'unknown';

export interface DesktopUpdateError {
  kind: DesktopUpdateErrorKind;
  message: string;
}

export interface DesktopUpdateProgress {
  /** Bytes downloaded so far — already cumulative, the shell does the summing. */
  downloaded: number;
  /** Absent when the download carried no `Content-Length` — render indeterminate. */
  total?: number | null;
}

/**
 * Shape a rejected updater command back into a typed error. Tauri serializes a
 * command's `Err` payload as-is, so a real `UpdateError` arrives as the object
 * below — but a rejection can ALSO come from the IPC layer itself (an older
 * shell binary that lacks the command), which arrives as a bare string. Both
 * have to end up as something the UI can render.
 */
function asDesktopUpdateError(error: unknown): DesktopUpdateError {
  const kind = (error as DesktopUpdateError | null)?.kind;
  if (typeof kind === 'string') return error as DesktopUpdateError;
  return { kind: 'unknown', message: String((error as Error)?.message ?? error) };
}

/**
 * Ask the shell whether an update is waiting. Request/response on purpose: the
 * shell also EMITS `update:available` from its background poll, but an event
 * fired before this document mounted its listener is simply gone — so the
 * startup answer has to be pulled, not awaited.
 *
 * Null outside the desktop shell, and on a desktop binary that predates the
 * command. Rejects with a {@link DesktopUpdateError} if the check itself failed
 * (offline, unreachable manifest), which callers treat as "don't know" rather
 * than "no update".
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdateAvailability | null> {
  if (!isDesktopShell()) return null;
  const invoke = tauriInvoke();
  if (!invoke) return null;
  try {
    return (await invoke('update_check')) as DesktopUpdateAvailability | null;
  } catch (error) {
    throw asDesktopUpdateError(error);
  }
}

/**
 * Download and install, then restart into the new version. Resolves only if the
 * restart somehow does not happen — on success the process is replaced, so
 * callers should treat the pending state as terminal and let the error path be
 * the only way back.
 */
export async function applyDesktopUpdate(): Promise<void> {
  if (!isDesktopShell()) return;
  const invoke = tauriInvoke();
  if (!invoke) return;
  try {
    await invoke('update_apply_now');
  } catch (error) {
    throw asDesktopUpdateError(error);
  }
}

/**
 * Subscribe to a Tauri event on the desktop shell. Resolves false when there is
 * no transport — not a shell, or `withGlobalTauri` off — so callers can tell
 * "nothing will ever arrive" from "nothing has arrived yet".
 */
async function listenDesktop<TPayload>(event: string, callback: (payload: TPayload) => void): Promise<boolean> {
  if (!isDesktopShell()) return false;
  const tauriEvent = tauriEventApi();
  if (!tauriEvent) return false;
  // The one assertion for this transport: the shell's event payloads are JSON the
  // bridge cannot describe, so each caller declares the shape it subscribed for.
  await tauriEvent.listen(event, e => callback(e?.payload as TPayload));
  return true;
}

/** A release published while the app was already running (shell's 45-min poll). */
export function onDesktopUpdateAvailable(
  callback: (availability: DesktopUpdateAvailability) => void,
): Promise<boolean> {
  return listenDesktop('update:available', callback);
}

/** Download progress, throttled shell-side to one frame per 200ms. */
export function onDesktopUpdateProgress(callback: (progress: DesktopUpdateProgress) => void): Promise<boolean> {
  return listenDesktop('update:progress', callback);
}

/**
 * The download finished and the installer is running. A distinct phase because
 * it is its own wait — a whole NSIS run on Windows — and because the throttled
 * progress stream never quite reaches the end, so without it the bar would hang
 * a hair short of full for the length of the install.
 */
export function onDesktopUpdateInstalling(callback: () => void): Promise<boolean> {
  return listenDesktop('update:installing', () => callback());
}

/**
 * Apply failures, as classified by the shell. Also delivered as the rejection
 * of {@link applyDesktopUpdate}; this event additionally covers an apply the
 * webview did not start.
 */
export function onDesktopUpdateError(callback: (error: DesktopUpdateError) => void): Promise<boolean> {
  return listenDesktop('update:error', callback);
}

/**
 * The current fullscreen element across both halves of the Fullscreen API. The
 * shell's deployment target is iOS 15.0 and WebKit only went unprefixed in 16.4,
 * so 15.4–16.3 expose `webkitFullscreenElement` alone. (media-chrome — what the
 * Mux player is built on — probes the same pair.)
 */
function fullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Android only: the software keyboard is up and has taken the navigation-bar
 * band out of the WebView. Capacitor's Android core pads the WebView's parent
 * by the `ime()` inset for as long as the keyboard shows (see
 * keyboard-inset.ts), and that inset spans the navigation bar — the IME window
 * is drawn behind it — so the resized WebView ends ABOVE the navigation band
 * and no longer contains it. Publishing the band anyway reserves space the page
 * cannot reach: the core `MobileBottomActions` bar (`.fixed.bottom-0` in
 * globals.css) sat on top of the keyboard with a nav-bar-sized strip of dead
 * space under its buttons.
 *
 * iOS is deliberately untouched. WKWebView keeps its frame there, so the
 * home-indicator band is still inside the viewport — merely covered — and a
 * `fixed` bottom bar is behind the keyboard entirely, where its padding is
 * moot.
 */
let keyboardCoversBottomInset = false;

/**
 * Set by the keyboard listener in keyboard-inset.ts. It routes through this
 * module rather than writing `--native-safe-bottom` itself because
 * `initNativeChrome` republishes all four insets on every `resize` — and on
 * Android the keyboard IS a resize, so an outside write would be clobbered by
 * that handler's trailing read 350ms later. The read stays authoritative; this
 * only decides what it publishes for the bottom edge.
 */
export function setKeyboardCoversBottomInset(covered: boolean): void {
  if (covered === keyboardCoversBottomInset) return;
  keyboardCoversBottomInset = covered;
  void applyNativeSafeAreas();
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
  // Never publish insets while an element is fullscreen. Capacitor turns on
  // WKWebView element fullscreen (`isElementFullscreenEnabled`), which is the path
  // the Mux player's fullscreen button takes, and both shells hide their system
  // bars to service it — so whatever a shell measures there is about the fullscreen
  // presentation, not the app chrome, and iOS measured 0 on all four edges until
  // the shell's fullscreen fix. A zero published while fullscreen is what sticks:
  // the app chrome comes back sitting under the notch. Nothing needs the values
  // meanwhile — the fullscreen element renders in the top layer, above the
  // safe-area band. iOS now measures the WINDOW and reports the true insets
  // throughout, so there the guard is belt and braces; Android still reads the
  // activity's `WindowInsets`, which the hidden system bars do move.
  //
  // This is NOT a defense against the iOS fullscreen-EXIT bug, which no JS can
  // reach: WebKit hands the web view back with its scroll view's
  // `contentInsetAdjustmentBehavior` reset, so the layout viewport loses the safe
  // area while the insets still report it, and everything pads twice. Repaired in
  // the shell (openframe-mobile `MainViewController`), not here.
  if (fullscreenElement()) return;
  try {
    const insets = await nativeAuthPlugin()?.getSafeAreaInsets?.();
    if (!insets) return;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--native-safe-top', `${insets.top}px`);
    // Suppressed while the keyboard holds the bottom band — see above.
    rootStyle.setProperty('--native-safe-bottom', `${keyboardCoversBottomInset ? 0 : insets.bottom}px`);
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
    const refresh = () => {
      void applyNativeSafeAreas();
      window.setTimeout(() => void applyNativeSafeAreas(), 350);
    };
    window.addEventListener('resize', refresh);
    // Leaving element fullscreen is a transition `resize` cannot be relied on to
    // cover: the viewport comes back the size it already was. (iOS does fire one
    // anyway — measured on 26.5 — but it is the same size, so it is a courtesy,
    // not a contract.) Without this the insets `applyNativeSafeAreas` skipped
    // during fullscreen would never be republished. Both spellings — see
    // `fullscreenElement`.
    document.addEventListener('fullscreenchange', refresh);
    document.addEventListener('webkitfullscreenchange', refresh);
  }
}
