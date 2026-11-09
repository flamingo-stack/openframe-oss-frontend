'use client';

import { useNatsJsonSubscription } from '@flamingo-stack/openframe-frontend-core/nats';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { MeshDesktop } from '@/lib/meshcentral/meshcentral-desktop';
import { MeshTunnel } from '@/lib/meshcentral/meshcentral-tunnel';
import { sessionPollsAllowed } from '@/lib/session-poll';
import {
  parseWatchEvent,
  remoteSessionWatchApiService as service,
  WatchDisabledError,
  WatchEndedError,
  type WatchGrant,
  type WatchViewer,
} from '../services/remote-session-watch-api-service';
import { SessionNotFoundError } from '../services/session-recordings-service';
import { deviceQueryKeys } from '../utils/query-keys';

/** MeshCentral relay protocol number for the desktop (KVM) stream. */
const DESKTOP_PROTOCOL = 2;

/** How often the watch admission is renewed while watching; the server keeps one for 30 s. */
export const WATCH_RENEW_MS = 10_000;

/** Failed redials in a row before the page stops and offers a retry instead: it never loops. */
export const MAX_FAILED_DIALS = 3;

/** How the gateway closes a watch socket once the session is over. */
const SESSION_ENDED_CLOSE = { code: 1008, reason: 'remote access ended' } as const;

const NOTIFICATION_SUBJECT_PREFIX = 'user';
const NOTIFICATION_SUBJECT_SUFFIX = 'notification';

export type WatchState = 'connecting' | 'streaming' | 'unavailable' | 'ended';

export interface UseRemoteSessionWatchResult {
  state: WatchState;
  /** Who is watching right now, from the last watch answer or viewer event. */
  viewers: WatchViewer[];
  /** The display the host streams; null until the multiplexer says. */
  display: number | null;
  /** The remote screen in pixels; null until the first screen size arrives. */
  resolution: { width: number; height: number } | null;
  /** Hands over the canvas the stream is drawn on (a callback ref). */
  attachCanvas: (canvas: HTMLCanvasElement | null) => void;
  /** Dials again after the page gave up. */
  retry: () => void;
}

function isSessionEndedClose(event: CloseEvent): boolean {
  return event.code === SESSION_ENDED_CLOSE.code && event.reason === SESSION_ENDED_CLOSE.reason;
}

/**
 * Watches a running session view-only (Watch live): asks `watchRemoteSession` for the dial, opens the session's remote
 * screen socket alone (no control socket, no mesh login) and draws what the host sees. The admission is renewed every
 * 10 s and again right before every redial, so a tab hidden for longer than the admission lasts still comes back. The
 * session's end (the gateway's close, the ENDED event, or a watch answer) stops the socket for good and reads the
 * session again, so the page turns into its ended state; three failed dials in a row stop it with a retry. Who is
 * watching comes with every watch answer and with each viewer event on the caller's notification subject.
 */
export function useRemoteSessionWatch(sessionId: string | null, live: boolean): UseRemoteSessionWatchResult {
  const queryClient = useQueryClient();
  const userId = useAuthStore(s => s.user?.id);
  const subscriptionOpen = useSubscriptionOpen();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<WatchState>('connecting');
  const [viewers, setViewers] = useState<WatchViewer[]>([]);
  const [display, setDisplay] = useState<number | null>(null);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Stops the current watch for good: `ended` or `unavailable`. Set by the dial effect. */
  const finishRef = useRef<((outcome: 'ended' | 'unavailable') => void) | null>(null);

  const active = !!sessionId && live && subscriptionOpen && state !== 'ended';

  const onEnded = useCallback(() => {
    if (sessionId) void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.liveSession(sessionId) });
  }, [queryClient, sessionId]);

  // The dial: one watch, one desktop and one socket per attempt.
  useEffect(() => {
    if (!active || !sessionId || !canvas) return undefined;
    let stopped = false;
    let tunnel: MeshTunnel | null = null;
    let endedByServer = false;
    const desktop = new MeshDesktop();
    desktop.attachRenderOnly(canvas);
    desktop.onScreenSizeChange((width, height) =>
      setResolution(prev => (prev?.width === width && prev.height === height ? prev : { width, height })),
    );
    desktop.onDisplayListChange((_displays, current) => setDisplay(current));
    desktop.onFirstFrame(() => {
      if (!stopped) setState('streaming');
    });

    const finish = (outcome: 'ended' | 'unavailable') => {
      if (stopped) return;
      stopped = true;
      tunnel?.stop();
      setState(outcome);
      if (outcome === 'ended') onEnded();
    };
    finishRef.current = finish;

    /** A refused watch stops the page; anything else (a network blip) leaves the socket to stream on. */
    const onWatchError = (error: unknown) => {
      if (error instanceof WatchEndedError) finish('ended');
      else if (error instanceof WatchDisabledError || error instanceof SessionNotFoundError) finish('unavailable');
    };

    const renew = async (): Promise<WatchGrant | null> => {
      try {
        const grant = await service.watch(sessionId);
        if (!stopped) setViewers(grant.viewers);
        return grant;
      } catch (error) {
        onWatchError(error);
        return null;
      }
    };

    void (async () => {
      const grant = await renew();
      if (!grant || stopped) {
        // A first watch that failed for no stated reason is a failed dial the technician can retry.
        if (!stopped) finish('unavailable');
        return;
      }
      tunnel = new MeshTunnel({
        authCookie: '',
        nodeId: grant.nodeId,
        protocol: DESKTOP_PROTOCOL,
        relayIdPrefix: `${grant.requestId}.w`,
        maxReconnectAttempts: MAX_FAILED_DIALS,
        shouldReconnect: event => {
          if (!isSessionEndedClose(event)) return true;
          endedByServer = true;
          return false;
        },
        // Renewed right before every redial: the admission may have lapsed while the tab was hidden.
        onBeforeReconnect: async () => {
          await renew();
        },
        onFailed: () => finish(endedByServer ? 'ended' : 'unavailable'),
        onData: () => {},
        onBinaryData: bytes => void desktop.onBinaryFrame(bytes),
        onStateChange: tunnelState => {
          if (stopped) return;
          if (tunnelState === 3) desktop.beginStream();
          else if (tunnelState === 1) setState(prev => (prev === 'streaming' ? 'connecting' : prev));
        },
      });
      desktop.setSender(bytes => tunnel?.sendBinary(bytes), { watch: true });
      tunnel.start();
    })();

    // Renewed while watching; a renewal is a mutation, so nothing goes out while the session is not healthy.
    const renewal = setInterval(() => {
      if (!stopped && sessionPollsAllowed()) void renew();
    }, WATCH_RENEW_MS);

    return () => {
      stopped = true;
      clearInterval(renewal);
      if (finishRef.current === finish) finishRef.current = null;
      tunnel?.stop();
      desktop.detach();
    };
  }, [active, sessionId, canvas, attempt, onEnded]);

  // The end and the viewer changes: the caller's notification subject, which carries them without an id.
  const subject = active && userId ? `${NOTIFICATION_SUBJECT_PREFIX}.${userId}.${NOTIFICATION_SUBJECT_SUFFIX}` : null;
  useNatsJsonSubscription<unknown>(
    subject,
    useCallback(
      payload => {
        if (!sessionId) return;
        const event = parseWatchEvent(payload, sessionId);
        if (!event) return;
        if (event.kind === 'ended') finishRef.current?.('ended');
        else setViewers(event.viewers);
      },
      [sessionId],
    ),
  );

  const retry = useCallback(() => {
    setState('connecting');
    setAttempt(n => n + 1);
  }, []);

  return { state, viewers, display, resolution, attachCanvas: setCanvas, retry };
}
