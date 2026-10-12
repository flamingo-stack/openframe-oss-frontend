/**
 * Mobile force-update: the client half of the version policy the backend
 * publishes on the shared host, and of the 426 the tenant gateway answers a
 * too-old bundle with.
 *
 * Two independent signals, two scales:
 *
 *   - **Update available** (dismissible nudge) — the SHELL version, i.e. what the
 *     store listing shows, below the platform's `latestVersion`.
 *   - **Update required** (blocking screen) — the BUNDLE version below
 *     `minBundleVersion`, or any 426 from the gateway. API compatibility is a
 *     property of the frozen bundle, so that is the scale the gateway gates on
 *     too. The 426 is what catches a signed-in user whose policy fetch failed.
 *
 * Mobile shell only. The web ships with the backend and is always current, and
 * desktop has its own updater: off mobile, nothing here fetches or flips state,
 * and a 426 is an ordinary failed request.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { isVersionBelow } from './app-version';
import { clientBundleVersion } from './client-identity';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from './mobile-app-links';
import { nativeShellVersion } from './native-shell';
import { isMobileShell, mobilePlatform } from './platform';
import { runtimeEnv } from './runtime-config';

/** HTTP 426 Upgrade Required — the gateway's answer to a mobile bundle below `minBundleVersion`. */
export const UPGRADE_REQUIRED_STATUS = 426;

/**
 * On the shared host, beside `/sas/tenant/discover`: the authorization server owns
 * `/sas/**` there. Not under `/mobile`, which the gateway hands to this app's
 * install page — a misrouted policy request would read as "no policy", silently.
 * The backend contract is CU-86akqnhyd.
 */
const VERSION_POLICY_PATH = '/sas/mobile/version-policy';

const POLICY_TIMEOUT_MS = 10_000;
const NUDGE_SNOOZE_MS = 24 * 60 * 60 * 1000;
const NUDGE_SNOOZE_KEY = 'openframe:update-nudge-snooze';

interface PlatformPolicy {
  latestVersion?: string;
  storeUrl?: string;
}

interface VersionPolicy {
  minBundleVersion?: string;
  ios?: PlatformPolicy;
  android?: PlatformPolicy;
}

interface AppUpdateState {
  policy: VersionPolicy | null;
  /**
   * Set once and never cleared: a bundle the gateway refuses stays refused for
   * the life of this document. `storeUrl` is the 426 body's, when it had one.
   */
  required: { storeUrl: string | null } | null;
  /** The `latestVersion` the nudge offers, while it is due and not snoozed. */
  available: string | null;
}

export const useAppUpdateStore = create<AppUpdateState>()(
  devtools(() => ({ policy: null, required: null, available: null }), { name: 'app-update-store' }),
);

export const UPDATE_REQUIRED_MESSAGE = 'This version of OpenFrame is no longer supported. Update the app to continue.';

/** A request the gateway refused because this bundle is too old. Never retried: it cannot succeed. */
export class UpdateRequiredError extends Error {
  constructor() {
    super(UPDATE_REQUIRED_MESSAGE);
    this.name = 'UpdateRequiredError';
  }
}

export function isUpdateRequired(): boolean {
  return useAppUpdateStore.getState().required !== null;
}

/** Flip the app into the blocking "Update required" screen. Mobile only. */
function markUpdateRequired(storeUrl: string | null = null): void {
  if (!isMobileShell()) return;
  const { required } = useAppUpdateStore.getState();
  // The first 426 wins, but a later one may still carry the URL an earlier one lacked.
  if (required && (required.storeUrl || !storeUrl)) return;
  useAppUpdateStore.setState({ required: { storeUrl: safeStoreUrl(storeUrl) } });
}

/**
 * Whether a gateway response is the force-update 426 — recorded as such when it
 * is. Reads a CLONE, so the caller still owns the body. Off mobile it is never
 * one: the gateway gates only `ios`/`android` clients.
 */
export async function noteUpgradeRequired(response: Response): Promise<boolean> {
  if (response.status !== UPGRADE_REQUIRED_STATUS || !isMobileShell()) return false;
  let storeUrl: string | null = null;
  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === 'object' && 'storeUrl' in body && typeof body.storeUrl === 'string') {
      storeUrl = body.storeUrl;
    }
  } catch {
    // No JSON body: the cached policy or the published listing supplies the URL.
  }
  markUpdateRequired(storeUrl);
  return true;
}

/**
 * Only the schemes a store listing uses. The URL is server-supplied and goes
 * straight into `location.assign`, so `javascript:` and friends must not get
 * through.
 */
function safeStoreUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'itms-apps:' || protocol === 'market:' ? value : null;
  } catch {
    return null;
  }
}

/** 426 body → the policy fetched for this platform → the published listing. */
export function resolveStoreUrl(): string {
  const { required, policy } = useAppUpdateStore.getState();
  const platform = mobilePlatform();
  return (
    required?.storeUrl ??
    safeStoreUrl(platform ? policy?.[platform]?.storeUrl : null) ??
    (platform === 'android' ? GOOGLE_PLAY_URL : APP_STORE_URL)
  );
}

/**
 * A top-level navigation off the app's origin: both shells hand it to the OS
 * (iOS `decidePolicyFor` → `UIApplication.open`, Android `launchIntent` →
 * `ACTION_VIEW`), which is what opens `itms-apps:` / `market:` in the store app
 * rather than the WebView. `window.open` is dropped by the WebView.
 */
export function openStore(): void {
  window.location.assign(resolveStoreUrl());
}

// ─── Policy ─────────────────────────────────────────────────────────────────

function platformPolicy(value: unknown): PlatformPolicy | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { latestVersion, storeUrl } = value as Record<string, unknown>;
  return {
    latestVersion: typeof latestVersion === 'string' ? latestVersion : undefined,
    storeUrl: typeof storeUrl === 'string' ? storeUrl : undefined,
  };
}

function parsePolicy(value: unknown): VersionPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    minBundleVersion: typeof raw.minBundleVersion === 'string' ? raw.minBundleVersion : undefined,
    ios: platformPolicy(raw.ios),
    android: platformPolicy(raw.android),
  };
}

let inFlight: Promise<void> | null = null;

/**
 * Fetch the policy and re-derive both prompts. Called on cold start and on
 * every foreground resume: a phone app sits backgrounded for weeks, and a
 * cold-start-only check misses exactly the oldest installs.
 *
 * Independent of the session, so it also runs before login. A plain GET with no
 * custom header (not through `apiClient`, which adds `X-OpenFrame-Client`): the
 * shared host stays CORS-simple, so there is no preflight. Every failure is
 * silent — no policy means no prompt, never a blocked app.
 */
export function refreshVersionPolicy(): Promise<void> {
  if (!isMobileShell()) return Promise.resolve();
  const sharedHost = runtimeEnv.sharedHostUrl().replace(/\/+$/, '');
  if (!sharedHost) return Promise.resolve();

  inFlight ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), POLICY_TIMEOUT_MS);
    try {
      const response = await fetch(`${sharedHost}${VERSION_POLICY_PATH}`, {
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) return;
      const policy = parsePolicy(await response.json());
      if (policy) applyPolicy(policy, await nativeShellVersion());
    } catch (error) {
      console.warn('[Version Check] policy unavailable:', error);
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}

function applyPolicy(policy: VersionPolicy, shellVersion: string | null): void {
  const platform = mobilePlatform();
  const latest = platform ? policy[platform]?.latestVersion : undefined;
  const available = latest && isVersionBelow(shellVersion, latest) && !isNudgeSnoozed(latest) ? latest : null;
  useAppUpdateStore.setState({ policy, available });
  if (isVersionBelow(clientBundleVersion(), policy.minBundleVersion)) markUpdateRequired();
}

// ─── Nudge snooze ───────────────────────────────────────────────────────────

/** Keyed by the version dismissed: a newer release shows the nudge again at once. */
function isNudgeSnoozed(version: string): boolean {
  try {
    const raw = window.localStorage.getItem(NUDGE_SNOOZE_KEY);
    if (!raw) return false;
    const snooze = JSON.parse(raw) as { version?: unknown; until?: unknown };
    return snooze.version === version && typeof snooze.until === 'number' && snooze.until > Date.now();
  } catch {
    return false;
  }
}

export function dismissUpdateNudge(): void {
  const { available } = useAppUpdateStore.getState();
  if (!available) return;
  useAppUpdateStore.setState({ available: null });
  try {
    window.localStorage.setItem(
      NUDGE_SNOOZE_KEY,
      JSON.stringify({ version: available, until: Date.now() + NUDGE_SNOOZE_MS }),
    );
  } catch {
    // Storage unavailable: the nudge comes back on the next resume, which is all that is lost.
  }
}
