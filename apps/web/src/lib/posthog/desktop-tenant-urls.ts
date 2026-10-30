/**
 * The desktop app runs from `tauri://localhost` (`http://tauri.localhost` on Windows) for every
 * tenant, so its events and recordings would all name that instead of the tenant, and none could be
 * filtered by tenant the way the web's can. This moves them to the origin the same page has on the
 * web. `app_platform: desktop` is what still tells them apart.
 */

import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getStoredTenantHost } from '@/lib/native-shell';
import { runtimeEnv } from '@/lib/runtime-config';

type Properties = Record<string, unknown>;

interface PostHogCapture {
  properties: Properties;
  $set?: Properties;
  $set_once?: Properties;
}

/** An rrweb event. A compressed one holds its `data` as a string, and no URL of ours is in those. */
interface RecordingEvent {
  data?: { href?: unknown; payload?: { href?: unknown } };
}

/**
 * The stored host is only trusted while signed in: it is never cleared, so after a sign-out it names
 * the tenant being left. Before sign-in the page is on the shared host, as it is on the web.
 */
function currentOrigin(): string {
  const signedIn = Boolean(useAuthStore.getState().user);
  return (signedIn && getStoredTenantHost()) || runtimeEnv.sharedHostUrl();
}

/** PostHog's `before_send`. Leaves the event as it is while no origin is known. */
export function moveToTenantOrigin<T extends PostHogCapture | null>(capture: T): T {
  if (!capture) return capture;
  try {
    const bundle = window.location;
    const tenant = new URL(currentOrigin());
    const moveUrl = (url: string) =>
      url.startsWith(bundle.origin) ? tenant.origin + url.slice(bundle.origin.length) : url;

    for (const properties of [capture.properties, capture.$set, capture.$set_once]) {
      if (!properties) continue;
      for (const [key, value] of Object.entries(properties)) {
        if (typeof value !== 'string') continue;
        // By value, not by name: the SDK also derives `$initial_` and `$session_entry_` copies.
        properties[key] = key.endsWith('host') && value === bundle.host ? tenant.host : moveUrl(value);
      }
    }

    // The recording's own page URLs: `Meta` and `$json_ld` carry `data.href`, and `$pageview` and
    // `$url_changed` carry `data.payload.href`.
    const recording = capture.properties.$snapshot_data;
    if (Array.isArray(recording)) {
      for (const { data } of recording as RecordingEvent[]) {
        if (typeof data?.href === 'string') data.href = moveUrl(data.href);
        if (typeof data?.payload?.href === 'string') data.payload.href = moveUrl(data.payload.href);
      }
    }
  } catch {
    // Analytics is best-effort, and a bad origin must not cost the event.
  }
  return capture;
}
