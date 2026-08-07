import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { runtimeEnv } from './runtime-config';

/**
 * Server-known flag names. Must be passed to `feFeatureFlags(names: ...)`;
 * the backend only returns flags that are explicitly requested.
 */
export const FEATURE_FLAG_NAMES = [
  'billings',
  'help-center',
  'notifications',
  'batch-approval',
  'debug-nats-chunks',
  'mingo-sidebar',
  'mingo-sidebar-context',
  'guide-chunks',
  'mingo-ai-chat-settings',
  'customer-ai-assistant-settings',
  'customer-ai-configuration',
  'customer-guardrails',
  'time-tracker',
  'scripts-v2',
  'script-schedules',
  'script-schedule-device-online',
  'cancel-subscription',
  'test-clock',
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
  batchApproval: {
    enabled(): boolean {
      return getFlagValue('batch-approval', () => false);
    },
  },
  debugNatsChunks: {
    enabled(): boolean {
      return getFlagValue('debug-nats-chunks', () => false);
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
  guideChunks: {
    enabled(): boolean {
      return getFlagValue('guide-chunks', () => false);
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
  scriptsV2: {
    enabled(): boolean {
      return getFlagValue('scripts-v2', () => false);
    },
  },
  /**
   * Scripts Schedules module (`/scripts-v2/schedules/*`) — the scheduled-run
   * list, detail, create/edit, and device-assignment pages. Nested under the
   * `scripts-v2` flag: schedules require the v2 Scripts area, and this flag
   * gates the schedules sub-module independently on top of it. Off → the
   * schedules routes redirect to the Scripts list and the "Scripts Schedules"
   * tab is hidden. Defaults off when unset.
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
