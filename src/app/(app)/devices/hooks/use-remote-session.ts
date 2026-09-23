'use client';

import { useNatsJsonSubscription } from '@flamingo-stack/openframe-frontend-core/nats';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import {
  applyRemoteSessionEvent,
  parseRemoteSessionEvent,
  remoteSessionApiService,
} from '../services/remote-session-api-service';
import type { RemoteSession, RemoteSessionEnd } from '../types/remote-access';

export interface UseRemoteSessionResult {
  /** The backend session behind the mounted surface; null until found, and always on the mock. */
  session: RemoteSession | null;
  /** Set once the session is over - from the push, the poll, or this technician's own end. */
  ended: RemoteSessionEnd | null;
  /** The technician leaves: the session is over here at once, and the backend is told once. */
  endSession: () => void;
}

/** The record is created in the same transition as APPROVED; a few short retries cover the race. */
const LOOKUP_ATTEMPTS = 5;
const LOOKUP_RETRY_MS = 1_000;
/** Poll fallback for a missed ENDED push. */
const POLL_MS = 5_000;

const NOTIFICATION_SUBJECT_PREFIX = 'user';
const NOTIFICATION_SUBJECT_SUFFIX = 'notification';

function endOf(session: RemoteSession): RemoteSessionEnd {
  return { endReason: session.endReason ?? null, endedAt: session.endedAt ?? null };
}

/** The fields the page reacts to; a poll answer that changed none of them is not a new object. */
function sameSession(a: RemoteSession, b: RemoteSession): boolean {
  return (
    a.sessionId === b.sessionId && a.status === b.status && a.dialogId === b.dialogId && a.endReason === b.endReason
  );
}

/**
 * The lifecycle of the session an approved request opened: the record behind
 * it (`activeRemoteSession` right after approval, or the STARTED push), its
 * end (REMOTE_SESSION_ENDED on the technician's notification subject, with a
 * poll as the fallback) and the technician's own end on leave. Until the
 * gateway closes relays itself, this is what ends the stream on both sides.
 * `live` is false on the mock approval backend, where no record exists.
 */
export function useRemoteSession(deviceId: string, requestId: string | null, live: boolean): UseRemoteSessionResult {
  const enabled = live && requestId !== null;
  const userId = useAuthStore(s => s.user?.id);
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [ended, setEnded] = useState<RemoteSessionEnd | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  // True once the end reached the backend or came from it: the end call goes
  // out at most once, whichever path fires first.
  const endedRef = useRef(false);
  useEffect(() => {
    if (ended) endedRef.current = true;
  }, [ended]);

  const settle = useCallback((end: RemoteSessionEnd) => {
    setEnded(prev => prev ?? end);
    setSession(prev => (prev ? { ...prev, status: 'ENDED', endReason: end.endReason, endedAt: end.endedAt } : prev));
  }, []);

  const adopt = useCallback(
    (found: RemoteSession) => {
      setSession(prev => (prev && (prev.status === 'ENDED' || sameSession(prev, found)) ? prev : found));
      if (found.status === 'ENDED') settle(endOf(found));
    },
    [settle],
  );

  // The record right after approval.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lookup = () => {
      attempt++;
      const retry = () => {
        if (!cancelled && attempt < LOOKUP_ATTEMPTS && !sessionRef.current) {
          timer = setTimeout(lookup, LOOKUP_RETRY_MS);
        }
      };
      remoteSessionApiService
        .active(deviceId)
        .then(found => {
          if (cancelled) return;
          if (found) adopt(found);
          else retry();
        })
        .catch(retry);
    };
    lookup();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, deviceId, adopt]);

  // The push: the same subject the decision arrives on. Events for other
  // sessions are dropped; a repeated event is a no-op after the merge.
  const subject = enabled && userId ? `${NOTIFICATION_SUBJECT_PREFIX}.${userId}.${NOTIFICATION_SUBJECT_SUFFIX}` : null;
  useNatsJsonSubscription<unknown>(
    subject,
    useCallback(
      payload => {
        const event = parseRemoteSessionEvent(payload);
        if (!event) return;
        const current = sessionRef.current;
        const mine = current ? event.sessionId === current.sessionId : event.requestId === requestId;
        if (!mine) return;
        if (process.env.NODE_ENV === 'development') {
          // Dev-only trace: the one way to tell the push from the poll when checking a backend.
          console.debug('[remote-session] push', event.type, event.endReason ?? '');
        }
        setSession(prev => applyRemoteSessionEvent(prev, event));
        if (event.type === 'REMOTE_SESSION_ENDED') {
          settle({ endReason: event.endReason, endedAt: event.endedAt ?? null });
        }
      },
      [requestId, settle],
    ),
  );

  // The poll while the session is live.
  const activeSessionId = session && !ended ? session.sessionId : null;
  useEffect(() => {
    if (!enabled || !activeSessionId) return undefined;
    const poll = setInterval(() => {
      remoteSessionApiService
        .get(activeSessionId)
        .then(current => {
          if (sessionRef.current?.sessionId === activeSessionId) adopt(current);
        })
        .catch(() => {
          // Transient poll failures are absorbed - the push and the next tick both still stand.
        });
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [enabled, activeSessionId, adopt]);

  const endSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current || endedRef.current) return;
    endedRef.current = true;
    settle({ endReason: 'admin', endedAt: new Date().toISOString() });
    remoteSessionApiService.end(current.sessionId).catch(() => {
      // Best-effort: the session cap on the backend ends what this call could not.
    });
  }, [settle]);
  const endSessionRef = useRef(endSession);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  // Leaving the page is the technician's end: `pagehide` covers a closed tab
  // or a reload (the request outlives the document), unmount covers in-app
  // navigation. StrictMode replays the cleanup once on mount in dev, so the
  // unmount end waits a tick and the replayed mount cancels it.
  const pendingEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    if (pendingEndRef.current) {
      clearTimeout(pendingEndRef.current);
      pendingEndRef.current = null;
    }
    const onPageHide = () => {
      const current = sessionRef.current;
      if (!current || endedRef.current) return;
      endedRef.current = true;
      remoteSessionApiService.endOnUnload(current.sessionId);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      pendingEndRef.current = setTimeout(() => {
        pendingEndRef.current = null;
        endSessionRef.current();
      }, 0);
    };
  }, [enabled]);

  return useMemo(() => ({ session, ended, endSession }), [session, ended, endSession]);
}
