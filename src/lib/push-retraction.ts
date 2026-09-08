/**
 * Clearing OS banners the server has retracted — the notification was read,
 * dismissed, or its approval resolved, on some other device.
 *
 * Split out of `native-push.ts` because that module imports Relay `graphql` tags,
 * which only the Relay compiler can transform; this half is pure wire-payload
 * handling and is unit-tested.
 *
 * Retraction is best-effort BY CONSTRUCTION, not by omission: an outbox row that
 * was claimed at the instant of resolution is neither cancellable nor retractable
 * (`PendingPushRepository.cancelPending` matches PENDING, `retractSent` matches
 * SENT — a CLAIMED row matches neither), so a stale banner remains possible and
 * every caller must keep treating "already resolved" as a normal outcome.
 */
import type { FirebaseMessagingPlugin } from './native-shell';
import { mobilePlatform } from './platform';

/** `FcmPushSender.EVENT_NOTIFICATION_RETRACTED` — the data-only push that clears a banner. */
const RETRACTION_EVENT = 'NOTIFICATION_RETRACTED';

/**
 * Notification ids this payload declares dead. Two sources, and the redundancy is
 * deliberate server-side: a retraction push names its target directly, and EVERY
 * push also carries the sender's rolling `retractedIds` list because FCM confirms
 * nothing (`FcmPushSender.putRetractedIds`). So a retraction that arrives while the
 * app is not running is picked up by the next push that is.
 */
export function parseRetractedIds(data: unknown): string[] {
  const payload = (data ?? {}) as Record<string, unknown>;
  const ids: string[] = [];
  if (payload.event === RETRACTION_EVENT && typeof payload.notificationId === 'string') {
    ids.push(payload.notificationId);
  }
  if (typeof payload.retractedIds === 'string') {
    try {
      const parsed: unknown = JSON.parse(payload.retractedIds);
      if (Array.isArray(parsed)) {
        ids.push(...parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      // A malformed list must not cost us the directly-named id above.
    }
  }
  return ids;
}

/**
 * Matches on OUR `notificationId` from the payload rather than on the delivered
 * notification's own identifier: that one is assigned by the OS (iOS derives it
 * from `apns-collapse-id`) and is not ours to predict.
 *
 * **iOS only in practice.** On Android the plugin builds the delivered list from
 * `StatusBarNotification`, so `data` is the Android `Notification.extras` bundle
 * (`android.title`/`android.text` — the FCM data map is explicitly NOT included)
 * and `id` is `String.valueOf(sbn.getId())`, an int that can never equal a server
 * ObjectId. Neither branch below can match, so this is a silent no-op there.
 * Android retraction belongs in the native messaging service, which owns the tag
 * it posted under (`NotificationManager.cancel(tag, id)`) — see the shell plan.
 */
export async function removeRetracted(plugin: FirebaseMessagingPlugin, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Enforced, not merely documented: on Android the filter below provably cannot match,
  // so the bridge round trip on every foreground push would be pure waste.
  if (mobilePlatform() === 'android') return;
  const doomed = new Set(ids);
  const { notifications } = await plugin.getDeliveredNotifications();
  // Disjunction, not a ternary: a delivered notification carrying a `notificationId`
  // that is simply not in this batch must still get its OS-assigned id checked.
  const matched = notifications.filter(notification => {
    const dataId = notification.data?.notificationId;
    return (
      (typeof dataId === 'string' && doomed.has(dataId)) ||
      (typeof notification.id === 'string' && doomed.has(notification.id))
    );
  });
  if (matched.length > 0) {
    await plugin.removeDeliveredNotifications({ notifications: matched });
  }
}
