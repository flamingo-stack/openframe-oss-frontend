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
  // TEMPORARY - remove once the approval API (CU-86ajx02gz) runs on every
  // environment. On = the approval-gated connect flow talks to the real
  // /api/v1/remote-access/** service (dev, where the backend is deployed);
  // off = the in-memory mock that the QA tooling above drives.
  'remote-access-approval-api',
  // The next remote access cut (v2): surfaces built ahead of their backend
  // that must stay hidden when v1 (`remote-access-approval`) reaches every
  // environment. On for dev / qa, absent elsewhere. Today: the "Remote Access
  // Permission" selector on the New Device page.
  'remote-access-v2',
  // The Incidents module (`/incidents`) over saas-api's `insights` API.
  'insights',
  // Tenant Management (CU-86akj8ajt): the Settings module that connects
  // Microsoft 365 / Google Workspace directories. The backend does not register
  // the name yet, so the module stays dark on qa/prod until it does; the dev
  // server treats the missing answer as "on" (`use-tenant-management-gate.ts`)
  // so the mock-backed UI can be exercised, while an explicit "off" still wins.
  'tenant-management',
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
  /**
   * Tenant Management (CU-86akj8ajt). Route/hub gating goes through
   * `useTenantManagementGate` (tri-state, dev bypass); this accessor is for
   * imperative reads only.
   */
  tenantManagement: {
    enabled(): boolean {
      return getFlagValue('tenant-management', () => false);
    },
  },
} as const;

/**
 * Feature flag keys
 */
export type FeatureFlagKey = keyof typeof featureFlags;
