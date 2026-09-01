'use client';

import { useEffect } from 'react';
import { commitMutation, useRelayEnvironment } from 'react-relay';
import type { recordPresenceMutation as RecordPresenceMutationType } from '@/__generated__/recordPresenceMutation.graphql';
import { recordPresenceMutation } from '@/graphql/notifications/record-presence-mutation';
import { isOnline, subscribeConnectivity } from '@/lib/connectivity';
import { isSessionActive, PRESENCE_IDLE_MS, subscribeSessionActivity } from '@/lib/session-activity';
import { useSubscriptionOpen } from './subscription-lock/subscription-guard';

/** `openframe.presence.ttl-seconds` in configs/base/application.yml. Named once so the
 *  invariant below is checkable rather than asserted in prose. */
const PRESENCE_TTL_MS = 30_000;
/** Spread beats across a tenant instead of synchronising them into QPS spikes. */
const JITTER_MS = 2_000;
/** Alt-tabbing fires a transition per switch; don't beat more often than this. */
const MIN_BEAT_GAP_MS = 5_000;
/** Headroom for mutation round-trip latency, which the interval arithmetic ignores. */
const SAFETY_MARGIN_MS = 3_000;
/**
 * The invariant: two consecutive intervals must fit inside the TTL, so one dropped
 * beat cannot open an absence window — `2 × (HEARTBEAT_MS + JITTER_MS) <= TTL`, i.e.
 * `HEARTBEAT_MS <= TTL/2 - JITTER_MS`, minus the margin above. Worst case today is
 * 2 × (10s + 2s) = 24s against a 30s TTL.
 *
 * Clamped because the formula is the thing an edit would break: pushing JITTER_MS past
 * TTL/2 would otherwise yield a negative delay and spin `setTimeout` in a tight loop
 * instead of degrading to a merely-wrong interval.
 */
const HEARTBEAT_MS = Math.max(MIN_BEAT_GAP_MS, PRESENCE_TTL_MS / 2 - JITTER_MS - SAFETY_MARGIN_MS);
/**
 * Module scope, not effect scope: the guard must survive a remount, or StrictMode's
 * dev double-mount and any `environment`/auth-gate identity change fire an immediate
 * unthrottled beat apiece.
 */
let lastBeatAt = 0;

/**
 * Reports "a human is at this session" so the backend can decide push timing.
 *
 * What it buys, precisely: `FcmPushChannel.resolveDueAt` gives a PRESENT user the
 * grace window (7s, long enough for `cancelPendingPush` to land) and an ABSENT one
 * `dueAt = now`. It does not suppress anything — suppression is the cancel
 * mutation. So this is a latency optimisation for people who are away, and its
 * failure mode is mild: a lapsed heartbeat costs one skipped grace window.
 *
 * Inert until `openframe.push.outbox.presence-enabled` is turned on server-side —
 * and that flag must flip LAST. While it is off every push is graced
 * unconditionally; flipping it before heartbeats are flowing makes every user look
 * absent and removes the window `cancelPendingPush` depends on.
 */
export function PresenceHeartbeat() {
  const environment = useRelayEnvironment();
  // A mutation on a timer, which is the one shape the subscription gate cannot
  // catch: mutations bypass it by design (see `useSubscriptionOpen`). Without
  // this, a locked workspace beat one failing `recordPresence` — and one console
  // error — every ten seconds behind the lock screen, for nothing: presence
  // steers push timing, and a workspace that is not paid for sends no push.
  //
  // False while the answer is still in flight too. A beat is worth nothing until
  // the app is open, and the guard's answer arrives in the same second anyway.
  const subscriptionOpen = useSubscriptionOpen();

  useEffect(() => {
    if (!subscriptionOpen) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const beat = () => {
      if (disposed) return false;
      // Offline: the mutation cannot succeed and would retry every tick forever.
      // Idle/backgrounded: absent is the honest answer, and the point of the signal.
      if (!isOnline() || !isSessionActive({ idleAfterMs: PRESENCE_IDLE_MS })) return false;
      if (Date.now() - lastBeatAt < MIN_BEAT_GAP_MS) return false;
      lastBeatAt = Date.now();
      commitMutation<RecordPresenceMutationType>(environment, {
        mutation: recordPresenceMutation,
        variables: {},
        onError: error => {
          console.warn('[Presence] recordPresence failed:', error);
        },
      });
      return true;
    };

    // Rescheduled from the beat that actually fired, not from the tick that asked for
    // one. Otherwise an edge-triggered beat leaves the next tick inside MIN_BEAT_GAP_MS,
    // which swallows it and stretches the real gap to about one and a half intervals —
    // quietly breaking the two-intervals-inside-the-TTL guarantee above.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          beat();
          schedule();
        },
        HEARTBEAT_MS + Math.random() * JITTER_MS,
      );
    };

    const beatAndReschedule = () => {
      if (beat()) schedule();
    };

    beat();
    schedule();
    // Regaining focus or foregrounding should register immediately rather than
    // waiting out the interval — that is the moment the user came back.
    const unsubscribeActivity = subscribeSessionActivity(beatAndReschedule);
    const unsubscribeConnectivity = subscribeConnectivity(online => {
      if (online) beatAndReschedule();
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribeActivity();
      unsubscribeConnectivity();
    };
  }, [environment, subscriptionOpen]);

  return null;
}
