import { authApiClient } from './auth-api-client';
import { DESKTOP_APP_SCHEME } from './desktop-auth-return';
import { getStoredTenantHost } from './native-shell';
import { isDesktopShell } from './platform';
import { hasStoredDownloadId, normalizeDownloadId } from './registration-attribution';
import { routes } from './routes';
import { runtimeEnv } from './runtime-config';
import { hasTokensSync } from './token-store';

/**
 * The download id of a desktop app opened from Applications or the Start menu, instead of through
 * the download page's "Open the app" link.
 *
 * The gateway answers the installer download with a 302 to GitHub, so the file carries no id. The
 * id stays behind in the browser that downloaded it: the gateway's `of_src` cookie holds it,
 * HttpOnly, on the shared domain. The app's webview has a cookie jar of its own, so only that
 * browser can send the cookie back, and only the gateway can read it. So the app opens our
 * hand-off page on the shared host in the default browser (`/auth/desktop-handoff`). The page asks
 * the gateway for the id (`authApiClient.desktopDownloadHandoff`; the gateway logs whether it found
 * one) and hands it to the app on `openframe-console://download?id=<id>`, the link "Open the app"
 * uses, so the shell's link handler and `storeDownloadId` take it from there. Without an id
 * (another default browser, a private window, cookies cleared, an install from winget, Homebrew or
 * Chocolatey, which never goes through the gateway) the page launches the bare link, which only
 * brings the app back, and the signup falls back to the backend's email or IP match, as before.
 *
 * A page rather than a gateway redirect to the scheme: a navigation to an external protocol commits
 * no document, so whoever dismissed the browser's prompt would be left on an empty tab. The page
 * keeps a button to try again, as `/auth/desktop-return` does for a sign-in. The app opens it with a
 * `#launch` fragment, which the page reads once and strips: only the app's own open looks the id up
 * and launches, so a reloaded or restored tab neither raises the app unasked nor counts again in the
 * gateway's log of found and missing cookies.
 *
 * Once per install and shared host, and only on an install nobody has signed in on: tokens or a
 * stored tenant host (kept through sign-out) mean someone here already has an account, and a
 * browser tab would only interrupt them. Per shared host because every install starts on the prod
 * host and is pointed at stage or QA through the shell's config.json afterwards. The app cannot see
 * what the browser got, so the marker is spent when the tab opens: the page has to be live on the
 * shared host before a desktop release opens it. A gateway that does not answer yet costs only the
 * id; the page still takes the person back to the app.
 */

/**
 * localStorage entry that makes the hand-off once per install and shared host: it holds the shared
 * host it was opened on, written before the browser opens.
 */
export const DOWNLOAD_HANDOFF_STARTED_KEY = 'of_desktop_download_handoff';

/** The fragment that marks the app's own open of the hand-off page: the one load that launches. */
export const DOWNLOAD_HANDOFF_LAUNCH_FRAGMENT = 'launch';

/** How long the page waits for the gateway before it sends the person back without an id. */
export const DOWNLOAD_HANDOFF_LOOKUP_TIMEOUT_MS = 5000;

/**
 * The app side: open the hand-off page in the default browser when this install should have one.
 * Call it after the page has taken any id an "Open the app" link brought and after the token store
 * has hydrated: both decide whether it is needed. Returns whether it opened.
 */
export function startDownloadHandoff(): boolean {
  if (!isDesktopShell()) return false;
  const sharedHost = runtimeEnv.sharedHostUrl().replace(/\/+$/, '');
  if (!sharedHost) return false;
  if (hasTokensSync() || getStoredTenantHost() || hasStoredDownloadId()) return false;
  try {
    if (window.localStorage.getItem(DOWNLOAD_HANDOFF_STARTED_KEY) === sharedHost) return false;
    window.localStorage.setItem(DOWNLOAD_HANDOFF_STARTED_KEY, sharedHost);
  } catch {
    // Storage that cannot keep the marker cannot make this once per install, so never.
    return false;
  }
  // The shell routes a new-window request for an external URL to the default browser. Trailing
  // slash: the canonical form under `trailingSlash: true`.
  window.open(
    `${sharedHost}${routes.auth.desktopHandoff}/#${DOWNLOAD_HANDOFF_LAUNCH_FRAGMENT}`,
    '_blank',
    'noopener,noreferrer',
  );
  return true;
}

/**
 * The browser side: the download id the gateway found in this browser's cookie, or null when it
 * found none, answered with anything else, or took longer than {@link DOWNLOAD_HANDOFF_LOOKUP_TIMEOUT_MS}.
 */
export async function lookUpHandoffDownloadId(): Promise<string | null> {
  const response = await authApiClient.desktopDownloadHandoff(AbortSignal.timeout(DOWNLOAD_HANDOFF_LOOKUP_TIMEOUT_MS));
  const id = response.ok ? response.data?.downloadId : undefined;
  return (typeof id === 'string' && normalizeDownloadId(id)) || null;
}

/**
 * The link that takes the person back to the app: `download_link.rs` in the shell stores the id it
 * carries, and brings its window up with or without one.
 */
export function desktopDownloadAppUrl(downloadId: string | null): string {
  const url = `${DESKTOP_APP_SCHEME}://download`;
  return downloadId ? `${url}?${new URLSearchParams({ id: downloadId })}` : url;
}
