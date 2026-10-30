/**
 * The desktop app runs from `tauri://localhost` (`http://tauri.localhost` on Windows) for every
 * tenant, so its events and recordings would all name that instead of the tenant, and none could be
 * filtered by tenant the way the web's can. This moves the page URLs they report to the origin the
 * same page has on the web. `app_platform: desktop` on the session's events is what still tells them
 * apart.
 */

import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { runtimeEnv } from '@/lib/runtime-config';

type Properties = Record<string, unknown>;

interface PostHogCapture {
  properties: Properties;
  $set?: Properties;
  $set_once?: Properties;
}

/** An rrweb event. A compressed full snapshot holds `data` as a string. */
interface RecordingEvent {
  data?: string | { href?: unknown };
}

/** Properties holding a bare host, with the `$initial_` and `$session_entry_` copies the SDK derives. */
const BARE_HOST_KEY = /(host|referring_domain)$/;

/**
 * The tenant host is only trusted while signed in: the stored one is never cleared, so after a sign-out
 * it names the tenant being left. Before sign-in the page is on the shared host, as it is on the web.
 *
 * `user` stays empty after the reload that follows a sign-in to a new host until `/me` answers, so that
 * moment reports the shared host. The tokens are no better a signal: they land before the host is
 * stored, so a tenant switch would name the previous tenant.
 */
function webOrigin(): string {
  const signedIn = Boolean(useAuthStore.getState().user);
  return (signedIn && runtimeEnv.tenantHostUrl()) || runtimeEnv.sharedHostUrl();
}

/** PostHog's `before_send`. Leaves the event as it is while no origin is known. */
export function moveToTenantOrigin(capture: PostHogCapture): PostHogCapture {
  try {
    const bundle = window.location;
    const web = new URL(webOrigin());
    const moveUrl = (url: string) =>
      url.startsWith(bundle.origin) ? web.origin + url.slice(bundle.origin.length) : url;

    const event = capture.properties;
    for (const properties of [event, capture.$set, capture.$set_once]) {
      if (!properties) continue;
      for (const [key, value] of Object.entries(properties)) {
        if (typeof value !== 'string') continue;
        // A URL is recognised by its value. A bare host needs its key too: `localhost` could be anything.
        properties[key] = BARE_HOST_KEY.test(key) && value === bundle.host ? web.host : moveUrl(value);
      }
    }

    // A recording names its page in `data.href` (`Meta`, `$json_ld`). Its `$pageview` events are built
    // from the `$current_url` moved above, and `$url_changed` stays silent while the GTM tag leaves
    // `capture_pageview` on. URLs inside the recorded DOM are out of reach.
    const recording = event.$snapshot_data;
    if (Array.isArray(recording)) {
      for (const { data } of recording as RecordingEvent[]) {
        if (!data || typeof data === 'string') continue;
        if (typeof data.href === 'string') data.href = moveUrl(data.href);
      }
    }

    // `$$heatmap` keys its points by page URL.
    const heatmap = event.$heatmap_data;
    if (heatmap) {
      event.$heatmap_data = Object.fromEntries(
        Object.entries(heatmap as Properties).map(([url, points]) => [moveUrl(url), points]),
      );
    }
  } catch {
    // Analytics is best-effort, and a bad origin must not cost the event.
  }
  return capture;
}
