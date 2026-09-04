/**
 * Mobile-shell push notifications: permission → FCM registration token handed
 * to the backend, and notification taps forwarded to the host as the raw FCM
 * `data` map. Routing is deliberately NOT done here — the caller resolves it
 * with the same table the in-app drawer uses, so the backend never has to know
 * a frontend route. All push flows through Firebase/FCM on both platforms
 * (@capacitor-firebase/messaging, shipped with the shell — not an npm dep
 * here). Mobile-only: no-ops on the web, in the desktop shell, and in shells
 * without the plugin.
 *
 * Init runs post-login (registration is an authenticated call; the permission
 * prompt belongs after sign-in, not at launch).
 */
import { commitMutation, type GraphQLTaggedNode } from 'react-relay';
import type { MutationParameters } from 'relay-runtime';
import type { registerPushDeviceMutation as RegisterPushDeviceMutationType } from '@/__generated__/registerPushDeviceMutation.graphql';
import type { unregisterPushDeviceMutation as UnregisterPushDeviceMutationType } from '@/__generated__/unregisterPushDeviceMutation.graphql';
import type { PushPlatform } from '@/generated/schema-enums';
import { registerPushDeviceMutation } from '@/graphql/notifications/register-push-device-mutation';
import { unregisterPushDeviceMutation } from '@/graphql/notifications/unregister-push-device-mutation';
import { firebaseMessagingPlugin } from './native-shell';
import { mobilePlatform } from './platform';
import { parseRetractedIds, removeRetracted } from './push-retraction';
import { getRelayEnvironment } from './relay';

const PUSH_TOKEN_STORAGE_KEY = 'native:push-token';

/**
 * Listeners attach once per document; token registration does NOT. Splitting the two
 * is load-bearing: on the mobile shell `forceLogout` returns WITHOUT reloading the
 * WebView in saas-tenant mode (force-logout.ts) — which every openframe-mobile build
 * lane defaults to — so a 401 re-login keeps module state. A single latch over the
 * whole function meant the new session never called `registerPushDevice`, leaving the
 * FCM token bound server-side to the PREVIOUS user and delivering their notification
 * titles to this device.
 */
let listenersAttached = false;
/** Read by the tap listener so a re-login's callback replaces the first one's. */
let onTap: ((data: Record<string, unknown> | undefined) => void) | null = null;

/** Platform uppercased for the PushPlatform enum; null off the mobile shell. */
function pushPlatform(): PushPlatform | null {
  const platform = mobilePlatform();
  return platform ? (platform.toUpperCase() as PushPlatform) : null;
}

function commitPushMutation<T extends MutationParameters>(
  mutation: GraphQLTaggedNode,
  variables: T['variables'],
): Promise<void> {
  return new Promise((resolve, reject) => {
    commitMutation<T>(getRelayEnvironment(), {
      mutation,
      variables,
      onCompleted: () => resolve(),
      onError: reject,
    });
  });
}

/**
 * Push contract `registerPushDevice(token, platform)`: idempotent upsert by
 * token, re-binding a token previously owned by another user. The token is also
 * persisted locally for logout-time deregistration.
 */
async function registerPushDevice(token: string): Promise<void> {
  const platform = pushPlatform();
  if (!platform) return;
  try {
    window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Best-effort: only affects logout-time deregistration.
  }
  try {
    await commitPushMutation<RegisterPushDeviceMutationType>(registerPushDeviceMutation, { token, platform });
  } catch (error) {
    // Non-fatal: FCM re-emits the token on rotation and every init re-registers.
    console.warn('[Native Push] registerPushDevice failed:', error);
  }
}

/**
 * Push contract `unregisterPushDevice(token)`: best-effort; an unknown token is
 * not an error, and a failure must not block logout.
 */
async function unregisterPushDevice(token: string): Promise<void> {
  try {
    await commitPushMutation<UnregisterPushDeviceMutationType>(unregisterPushDeviceMutation, { token });
  } catch (error) {
    console.warn('[Native Push] unregisterPushDevice failed:', error);
  }
}

/**
 * Registers one plugin listener, absorbing a failure to attach. See the call site for
 * why a rejection must not propagate.
 */
async function attachListener(eventName: string, register: () => Promise<unknown>): Promise<void> {
  try {
    await register();
  } catch (error) {
    console.warn(`[Native Push] ${eventName} listener registration failed:`, error);
  }
}

/**
 * @param onNotificationTap receives the tapped notification's FCM `data` map
 *   verbatim (a flat string map; see resolvePushNotificationRoute). Fires for a
 *   cold-start tap too — the plugin retains the event until a listener consumes
 *   it, so mounting after launch does not lose it.
 */
export async function initNativePush(
  onNotificationTap: (data: Record<string, unknown> | undefined) => void,
): Promise<void> {
  const plugin = firebaseMessagingPlugin();
  if (!plugin) return;
  onTap = onNotificationTap;

  if (!listenersAttached) {
    listenersAttached = true;
    await attachPushListeners(plugin);
  }

  const { receive } = await plugin.requestPermissions();
  if (receive !== 'granted') return;

  // Runs on EVERY init, not just the first: re-login inside one document must rebind
  // the token to the new user. The backend upsert is idempotent and re-binds a token
  // previously owned by someone else, so repeating it is the fix, not a cost.
  const { token } = await plugin.getToken();
  await registerPushDevice(token);
}

async function attachPushListeners(plugin: NonNullable<ReturnType<typeof firebaseMessagingPlugin>>): Promise<void> {
  // Attach listeners before getToken(): the token event can fire immediately,
  // and iOS replays the launching notification's tap to a fresh listener on
  // cold start.
  //
  // Every registration is isolated. `initialized` latches above, so ANY rejection
  // escaping this function is terminal for the session — no tap handler, no token,
  // no push at all, with no retry. That is too high a price for one listener failing
  // to attach, so each failure is logged and the rest still run.
  await attachListener('notificationActionPerformed', () =>
    plugin.addListener('notificationActionPerformed', ({ notification }) => {
      onTap?.(notification?.data);
    }),
  );

  // FCM issues the token here and re-emits it on rotation — re-register each time.
  await attachListener('tokenReceived', () =>
    plugin.addListener('tokenReceived', ({ token }) => {
      void registerPushDevice(token);
    }),
  );

  // Ordered after tokenReceived: this one is cosmetic cleanup and must never outrank
  // getting the device registered.
  await attachListener('notificationReceived', () =>
    plugin.addListener('notificationReceived', ({ notification }) => {
      void removeRetracted(plugin, parseRetractedIds(notification?.data)).catch(error => {
        console.warn('[Native Push] retraction cleanup failed:', error);
      });
    }),
  );
}

/**
 * Deregister this device server-side. Call while still authenticated (before
 * local tokens are cleared on logout).
 */
export async function unregisterNativePush(): Promise<void> {
  if (!firebaseMessagingPlugin()) return;

  let token: string | null = null;
  try {
    token = window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  if (!token) return;

  await unregisterPushDevice(token);
  try {
    window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // The token has already been unregistered server-side; failing to clear the local copy only means the next start re-registers a token the backend no longer knows.
  }
}
