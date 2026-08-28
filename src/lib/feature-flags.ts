import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { runtimeEnv } from './runtime-config';

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
  'notifications-legacy-path',
  'batch-approval',
  'debug-nats-chunks',
  'mingo-sidebar',
  'mingo-sidebar-context',
  'mingo-ai-chat-settings',
  'customer-ai-assistant-settings',
  'customer-ai-configuration',
  'customer-guardrails',
  'time-tracker',
  'script-schedules',
  'script-schedule-device-online',
  'cancel-subscription',
  'test-clock',
  'download-apps',
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
  /**
   * Rollback lever for the notification `type` + `attributes` migration: it selects which
   * of the two contracts the row mapper reads. OFF (the default, and the normal state) →
   * the spec pair `type` + `attributes`; ON → the legacy typed `context`.
   *
   * The selection is EXCLUSIVE, in both directions: the shape the lever does not name is
   * not read at all, so a row carrying only that shape maps with no type and no entity ids
   * instead of answering from the other contract. A rollback is therefore a clean swap of
   * contracts, never a per-row mixture — at the cost that rows the backfill migration has
   * not swept yet lose their navigation while the lever is OFF. `mapNotificationNode` in
   * `graphql/notifications/notifications-helpers.ts` is where that is implemented, and
   * `notifications-contract.test.ts` pins it.
   *
   * Mirrors the backend's `notifications.legacy-path` kill-switch by name, but is a
   * separate switch for a separate job — that one decides what gets WRITTEN, this one
   * what we READ. It exists so a rollback needs no frontend release; the flag is read
   * even before it is declared server-side, where it simply resolves to OFF.
   *
   * NOT covered by this lever: the transport routing path (`notification-navigation.ts`
   * `routeFromWireFields`, and the NATS payload helpers in `notifications-data-provider`),
   * which reads whichever shape a push happens to carry. Those run on cold-start taps
   * where no flags are loaded, and a push carries one shape anyway — the backend's own
   * kill-switch decides which.
   */
  notificationsLegacyPath: {
    enabled(): boolean {
      return getFlagValue('notifications-legacy-path', () => false);
    },
  },
  batchApproval: {
    enabled(): boolean {
      return getFlagValue('batch-approval', () => false);
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
  mingoSidebar: {
    enabled(): boolean {
      return getFlagValue('mingo-sidebar', () => false);
    },
  },
  mingoSidebarContext: {
    enabled(): boolean {
      return getFlagValue('mingo-sidebar-context', () => false);
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
  /**
   * Scripts Schedules module (`/scripts/schedules/*`) — the scheduled-run
   * list, detail, create/edit, and device-assignment pages. Off → the schedules
   * routes redirect to the Scripts list and the "Scripts Schedules" tab is
   * hidden. Defaults off when unset.
   */
  scriptSchedules: {
    enabled(): boolean {
      return getFlagValue('script-schedules', () => false);
    },
  },
  /**
   * The DEVICE_ONLINE trigger on the schedule form — "Run when device comes
   * online", the event-driven alternative to a date and time. Off → the form
   * offers no trigger choice at all and every schedule it writes is DATE_TIME.
   *
   * Nested under `scriptSchedules`, which gates the module the form belongs to.
   * Defaults off when unset.
   */
  scriptScheduleDeviceOnline: {
    enabled(): boolean {
      return getFlagValue('script-schedule-device-online', () => false);
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
} as const;

/**
 * Feature flag keys
 */
export type FeatureFlagKey = keyof typeof featureFlags;
