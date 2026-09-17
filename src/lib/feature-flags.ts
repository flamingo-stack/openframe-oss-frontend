import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

/**
 * Server-known flag names. Must be passed to `feFeatureFlags(names: ...)`;
 * the backend only returns flags that are explicitly requested.
 */
export const FEATURE_FLAG_NAMES = [
  'ai-escalation',
  'ai-resolution',
  'billings',
  'help-center',
  'notifications',
  'debug-nats-chunks',
  // Mingo Guide Mode V3 — the agent answers through Hub MCP remote tools instead
  // of the local V2 tool set. Same flag name the saas-ai-agent backend reads, on
  // purpose: the command catalog the frontend shows and the tools the backend can
  // actually run have to be the same generation, and two names could drift.
  'ai-mingo-remote-tools',
  'mingo-ai-chat-settings',
  'customer-ai-assistant-settings',
  'customer-ai-configuration',
  'customer-guardrails',
  'time-tracker',
  // The "Timezone" control on the script-schedule form (SERVER vs DEVICE_LOCAL
  // `timeReference`). UI only: a schedule that already carries DEVICE_LOCAL
  // still reads and saves as one with the flag off, the picker is simply absent.
  'script-schedule-device-time',
  'cancel-subscription',
  'test-clock',
  'download-apps',
  // MeshCentral attended remote access (CU-86agfp8w9): the approval-gated
  // connect flow, the remote access policy UI and the session recordings
  // surfaces. Off = the legacy auto-start tunnel behavior, no policy UI.
  'remote-access-approval',
  // TEMPORARY - remove together with the remote access backend (approval API
  // CU-86ajx02gz, recordings storage CU-86akc3c5q). Shows the QA tooling that
  // drives the mock services: the simulate-decision strip on the awaiting
  // screen and the recording player's local .mcrec loader. On for dev / qa.
  'remote-access-mock-tools',
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

/**
 * A flag read that keeps "not answered yet" distinct from "off".
 *
 * Declared here rather than beside `useFeatureFlagGate` so non-React modules
 * (the navigation config) can be typed by it without importing a client hook.
 * See `use-feature-flag.ts` for why the distinction is load-bearing.
 */
export type FeatureFlagGate = 'loading' | 'on' | 'off';

/**
 * Read a feature flag value from the server-loaded store,
 * falling back to the env-var default if the store hasn't loaded
 * or doesn't contain the flag.
 */
function getFlagValue(flagName: string, envFallback: () => boolean): boolean {
  const store = useFeatureFlagsStore.getState();
  if (store.isLoaded && flagName in store.flags) {
    return store.flags[flagName];
  }
  return envFallback();
}

/** localStorage key that turns the chunk-stream console log on for THIS browser. */
export const DEBUG_NATS_CHUNKS_KEY = 'debug-nats-chunks';

/**
 * Client-side override for the chunk debug log — the ONE flag a local value may
 * win over the server on.
 *
 * Every product flag reads server-first on purpose: a client that could force a
 * feature on would render UI the tenant is not entitled to. This one renders
 * nothing — it only writes to the console — and the case it exists for is
 * exactly the one the server cannot serve: a developer running against a shared
 * backend whose tenant has the flag OFF, who would otherwise have to flip a flag
 * for every user of that tenant just to read their own stream.
 *
 * Enable with `localStorage.setItem('debug-nats-chunks', 'true')`, disable by
 * removing the key. Wrapped because Safari's private mode throws on access.
 */
function isDebugChunkLogForced(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEBUG_NATS_CHUNKS_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Feature flags management
 * Server-loaded via feFeatureFlags GraphQL query with env-var fallbacks
 */
export const featureFlags = {
  subscription: {
    enabled(): boolean {
      return getFlagValue('billings', () => false);
    },
  },
  helpCenter: {
    enabled(): boolean {
      return getFlagValue('help-center', () => false);
    },
  },
  notifications: {
    enabled(): boolean {
      return getFlagValue('notifications', () => false);
    },
  },
  debugNatsChunks: {
    enabled(): boolean {
      // Local override FIRST — see `isDebugChunkLogForced`: a server value of
      // `false` must not silence a log the developer switched on for their own
      // browser, which a plain `envFallback` could not express.
      return isDebugChunkLogForced() || getFlagValue(DEBUG_NATS_CHUNKS_KEY, () => false);
    },
  },
  aiEscalation: {
    enabled(): boolean {
      return getFlagValue('ai-escalation', () => false);
    },
  },
  aiResolution: {
    enabled(): boolean {
      return getFlagValue('ai-resolution', () => false);
    },
  },
  /**
   * Mingo Guide Mode V3 (Hub MCP remote tools). OFF is V2: the local tool set and
   * the four commands openframe ships. ON exposes the whole server-owned command
   * catalog — see `chat-slash-command-visibility.ts`.
   */
  mingoRemoteTools: {
    enabled(): boolean {
      return getFlagValue('ai-mingo-remote-tools', () => false);
    },
  },
  mingoAiChatSettings: {
    enabled(): boolean {
      return getFlagValue('mingo-ai-chat-settings', () => false);
    },
  },
  customerAiAssistantSettings: {
    enabled(): boolean {
      return getFlagValue('customer-ai-assistant-settings', () => false);
    },
  },
  // Old↔new switch for the customer AI-assistant tab (details + edit):
  // off (default) → the legacy appearance-only view (pre-session); on → the
  // new full Customer AI Configuration. Independent of `customerAiAssistantSettings`.
  customerAiConfiguration: {
    enabled(): boolean {
      return getFlagValue('customer-ai-configuration', () => false);
    },
  },
  customerGuardrails: {
    enabled(): boolean {
      return getFlagValue('customer-guardrails', () => false);
    },
  },
  timeTracker: {
    enabled(): boolean {
      return getFlagValue('time-tracker', () => false);
    },
  },
  cancelSubscription: {
    enabled(): boolean {
      return getFlagValue('cancel-subscription', () => false);
    },
  },
  /**
   * Dev/stage-only Stripe test-clock panel on Settings → Billing. Server-driven via
   * `feFeatureFlags` (`test-clock`), which the BE keeps in sync with the same
   * `openframe.billing.test-clock.enabled` switch that shapes the schema — so FE
   * visibility can't drift from field availability. Defaults off when unset.
   */
  testClock: {
    enabled(): boolean {
      return getFlagValue('test-clock', () => false);
    },
  },
  /**
   * MeshCentral attended remote access (CU-86agfp8w9): the approval-gated
   * connect flow, the policy UI and the session recordings surfaces. Off = the
   * legacy auto-start tunnel behavior. Route gating goes through
   * `useRemoteAccessApprovalGate` (tri-state); this accessor is for imperative
   * reads.
   */
  remoteAccessApproval: {
    enabled(): boolean {
      return getFlagValue('remote-access-approval', () => false);
    },
  },
} as const;

/**
 * Feature flag keys
 */
export type FeatureFlagKey = keyof typeof featureFlags;

/**
 * Resolve once the server has answered — or terminally failed.
 *
 * `featureFlags.*.enabled()` reports the env fallback before the answer, which is
 * acceptable wherever the read REPEATS (a render re-runs, a handler runs again on
 * the next click) and wrong wherever its result is KEPT. The slash-command filter
 * is the second kind: it rewrites a response the lib caches for the whole session
 * (`useSlashCommandRegistry` runs at `staleTime: Infinity`), so a guess made in
 * that window is the catalog the panel shows until the next reload.
 *
 * Always settles — the same guarantee `useFeatureFlagsReady` is built on:
 * `FeatureFlagsLoader` marks the flags loaded on query error and offline, and
 * marks them at mount in saas-shared mode.
 */
export function whenFeatureFlagsResolved(): Promise<void> {
  if (useFeatureFlagsStore.getState().isLoaded) return Promise.resolve();

  return new Promise(resolve => {
    const unsubscribe = useFeatureFlagsStore.subscribe(state => {
      if (!state.isLoaded) return;
      unsubscribe();
      resolve();
    });
  });
}
