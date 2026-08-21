'use client';

import { useEffect } from 'react';
import { commitMutation, useRelayEnvironment } from 'react-relay';
import type { recordPresenceMutation as RecordPresenceMutationType } from '@/__generated__/recordPresenceMutation.graphql';
import { recordPresenceMutation } from '@/graphql/notifications/record-presence-mutation';
import { isOnline, subscribeConnectivity } from '@/lib/connectivity';
import { isSessionActive, PRESENCE_IDLE_MS, subscribeSessionActivity } from '@/lib/session-activity';

/**
 * Reports "a human is at this session" so the backend can decide push timing.
 *
 * What it buys, precisely: `FcmPushChannel.resolveDueAt` gives a PRESENT user the
 * grace window (7s, long enough for `cancelPendingPush` to land) and an ABSENT one
 * `dueAt = now`. It does not suppress anything — suppression is the cancel
 * mutation. So this is a latency optimisation for people who are away, and its
 * failure mode is mild: a lapsed heartbeat costs one skipped grace window.
 *
 * Server TTL is 30s (`openframe.presence.ttl-seconds`). The interval must be at
 * most half of it, or a single dropped beat opens an absence window: at 20s the
 * next beat lands at t+40 against a t+30 expiry, and with the outbox draining every
 * 1s a push enqueued in that gap is gone before any cancel can reach it.
 *
 * Inert until `openframe.push.outbox.presence-enabled` is turned on server-side —
 * and that flag must flip LAST. While it is off every push is graced
 * unconditionally; flipping it before heartbeats are flowing makes every user look
 * absent and removes the window `cancelPendingPush` depends on.
 */

/** Half the 30s server TTL, so one dropped beat still lands inside the window. */
const HEARTBEAT_MS = 12_000;
/** Spread beats across a tenant instead of synchronising them into QPS spikes. */
const JITTER_MS = 3_000;
/** Alt-tabbing fires a transition per switch; don't beat more often than this. */
const MIN_BEAT_GAP_MS = 5_000;

export function PresenceHeartbeat() {
  const environment = useRelayEnvironment();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastBeatAt = 0;
    let disposed = false;

    const beat = () => {
      if (disposed) return;
      // Offline: the mutation cannot succeed and would retry every tick forever.
      // Idle/backgrounded: absent is the honest answer, and the point of the signal.
      if (!isOnline() || !isSessionActive({ idleAfterMs: PRESENCE_IDLE_MS })) return;
      if (Date.now() - lastBeatAt < MIN_BEAT_GAP_MS) return;
      lastBeatAt = Date.now();
      commitMutation<RecordPresenceMutationType>(environment, {
        mutation: recordPresenceMutation,
        variables: {},
        onError: error => {
          console.warn('[presence] recordPresence failed:', error);
        },
      });
    };

    const schedule = () => {
      timer = setTimeout(
        () => {
          beat();
          schedule();
        },
        HEARTBEAT_MS + Math.random() * JITTER_MS,
      );
    };

    beat();
    schedule();
    // Regaining focus or foregrounding should register immediately rather than
    // waiting out the interval — that is the moment the user came back.
    const unsubscribeActivity = subscribeSessionActivity(beat);
    const unsubscribeConnectivity = subscribeConnectivity(online => {
      if (online) beat();
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribeActivity();
      unsubscribeConnectivity();
    };
  }, [environment]);

  return null;
}
