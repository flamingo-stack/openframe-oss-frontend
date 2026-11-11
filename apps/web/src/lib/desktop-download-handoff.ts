import { getStoredTenantHost } from './native-shell';
import { isDesktopShell } from './platform';
import { hasStoredDownloadId } from './registration-attribution';
import { runtimeEnv } from './runtime-config';
import { hasTokensSync } from './token-store';

/**
 * The download id of a desktop app opened from Applications or the Start menu, instead of through
 * the download page's "Open the app" link.
 *
 * The gateway answers the installer download with a 302 to GitHub, so the file carries no id. The
 * id stays behind in the browser that downloaded it: the gateway's `of_src` cookie holds it,
 * HttpOnly, on the shared domain. The app's webview has a cookie jar of its own, so only that
 * browser can send the cookie back, and only the gateway can read it. So the app opens the
 * gateway's hand-off URL in the default browser; the gateway reads the cookie and redirects to
 * `openframe-console://download?id=<id>`, the link "Open the app" uses, and the shell's link
 * handler and `storeDownloadId` take it from there. Without the cookie (another default browser,
 * a private window, cookies cleared, an install from winget, Homebrew or Chocolatey, which never
 * goes through the gateway) the gateway answers a page saying the tab can be closed, and the
 * signup falls back to the backend's email or IP match, as before.
 *
 * Once per install and shared host, and only on an install nobody has signed in on: tokens or a
 * stored tenant host (kept through sign-out) mean someone here already has an account, and a
 * browser tab would only interrupt them. Per shared host because every install starts on the prod
 * host and is pointed at stage or QA through the shell's config.json afterwards.
 *
 * The page cannot see what the browser got, so the marker is spent before the gateway answers:
 * the gateway must serve the hand-off before a desktop release carrying this goes out.
 */

/** The gateway's hand-off endpoint, on the shared host the download link points at. */
export const DOWNLOAD_HANDOFF_PATH = '/v0/api/assets/download/handoff';

/**
 * localStorage entry that makes the hand-off once per install and shared host: it holds the shared
 * host it was opened on, written before the browser opens.
 */
export const DOWNLOAD_HANDOFF_STARTED_KEY = 'of_desktop_download_handoff';

/**
 * Open the hand-off in the default browser when this install should have one. Call it after the
 * page has taken any id an "Open the app" link brought and after the token store has hydrated:
 * both decide whether it is needed. Returns whether it opened.
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
  // The shell routes a new-window request for an external URL to the default browser.
  window.open(`${sharedHost}${DOWNLOAD_HANDOFF_PATH}`, '_blank', 'noopener,noreferrer');
  return true;
}
