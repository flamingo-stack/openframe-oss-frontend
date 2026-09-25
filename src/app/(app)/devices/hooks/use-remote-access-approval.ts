'use client';

import { useNatsJsonSubscription } from '@flamingo-stack/openframe-frontend-core/nats';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import {
  applyRemoteAccessDecisionEvent,
  parseRemoteAccessDecisionEvent,
} from '../services/remote-access-approval-api-service';
import { isSettledRequestStatus } from '../services/remote-access-approval-service';
import {
  type RemoteAccessCreateErrorCode,
  RemoteAccessCreateError,
  type RemoteAccessRequest,
} from '../types/remote-access';
import {
  type RemoteAccessApprovalServiceSelection,
  useRemoteAccessApprovalService,
} from './use-remote-access-approval-service';

/**
 * The technician-side view of one approval attempt:
 * idle -> requesting -> awaiting -> approved | denied | timed_out | error,
 * plus the two refusals of the create call itself:
 * `busy` - another technician holds a live request or an active session on the
 * device (409, no identifiers in the body); `unreachable` - the request could
 * not be published (503, the request is deleted, a retry is safe).
 * `cancel` revokes an awaiting request and returns to idle, `reset` returns
 * from any settled state to idle (the retry affordance).
 */
export type RemoteAccessApprovalState =
  'idle' | 'requesting' | 'awaiting' | 'approved' | 'denied' | 'timed_out' | 'busy' | 'unreachable' | 'error';

export interface UseRemoteAccessApprovalResult {
  state: RemoteAccessApprovalState;
  request: RemoteAccessRequest | null;
  error: string | null;
  /** The create refusal behind `busy` / `unreachable` / `error` from the API; null otherwise. */
  errorCode: RemoteAccessCreateErrorCode | null;
  /** True while the in-memory mock stands in for the backend (see useRemoteAccessApprovalService). */
  isMock: boolean;
  /** `reason` is optional - passed through when known, e.g. from a ticket. */
  requestAccess: (reason?: string) => void;
  /** Revoke the open request (technician cancel) and go back to idle. */
  cancel: () => void;
  /** From denied/timed_out/busy/unreachable/error back to idle. */
  reset: () => void;
}

function stateForSettled(request: RemoteAccessRequest): RemoteAccessApprovalState {
  switch (request.status) {
    case 'APPROVED':
      return 'approved';
    case 'DENIED':
      return 'denied';
    case 'TIMED_OUT':
    case 'EXPIRED':
      return 'timed_out';
    // REVOKED is only ever this technician's own cancel - land back on idle
    // rather than a dead end. CANCELLED is its never-emitted alias.
    case 'REVOKED':
    case 'CANCELLED':
      return 'idle';
    default:
      return 'awaiting';
  }
}

function stateForCreateError(code: RemoteAccessCreateErrorCode): RemoteAccessApprovalState {
  switch (code) {
    case 'DEVICE_HAS_LIVE_REQUEST':
    case 'DEVICE_HAS_ACTIVE_SESSION':
      return 'busy';
    case 'DEVICE_UNREACHABLE':
      return 'unreachable';
    default:
      return 'error';
  }
}

/** Poll interval for the decision fallback (the push channel is the fast path); 2 s per the contract. */
const POLL_MS = 2_000;

const NOTIFICATION_SUBJECT_PREFIX = 'user';
const NOTIFICATION_SUBJECT_SUFFIX = 'notification';

/**
 * The approval flow covers remote screen sessions only, so the wire
 * `sessionKind` is a constant rather than a parameter.
 */
export function useRemoteAccessApproval(
  deviceId: string,
  /** Mock resolution hint - see CreateRemoteAccessRequestInput.organizationId. */
  organizationId?: string,
): UseRemoteAccessApprovalResult {
  const selection = useRemoteAccessApprovalService();
  // The backend an attempt was created on serves that attempt to the end: the
  // flag answer can arrive (dev bypasses the gate before the flags load) or
  // flip while a request is open, and a request must never be polled, revoked
  // or listened for on the other backend.
  const [active, setActive] = useState<RemoteAccessApprovalServiceSelection | null>(null);
  const service = active?.service ?? selection.service;
  const isMock = active?.isMock ?? selection.isMock;
  const userId = useAuthStore(s => s.user?.id);
  const [state, setState] = useState<RemoteAccessApprovalState>('idle');
  const [request, setRequest] = useState<RemoteAccessRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RemoteAccessCreateErrorCode | null>(null);
  // Coalesces async outcomes the same way the player's seek generation does: a
  // newer attempt (or cancel/unmount) bumps it and older callbacks drop out.
  const attemptRef = useRef(0);

  useEffect(
    () => () => {
      attemptRef.current++;
    },
    [],
  );

  const applySettled = useCallback((settled: RemoteAccessRequest) => {
    setRequest(settled);
    setState(stateForSettled(settled));
  }, []);

  const requestAccess = useCallback(
    (reason?: string) => {
      const attempt = ++attemptRef.current;
      const chosen = selection;
      setActive(chosen);
      setError(null);
      setErrorCode(null);
      setState('requesting');
      (async () => {
        try {
          const created = await chosen.service.create({
            deviceId,
            sessionKind: 'desktop',
            reason,
            organizationId,
          });
          if (attempt !== attemptRef.current) return;
          setRequest(created);
          if (isSettledRequestStatus(created.status)) {
            applySettled(created);
            return;
          }
          setState('awaiting');
        } catch (e) {
          if (attempt !== attemptRef.current) return;
          if (e instanceof RemoteAccessCreateError) {
            setErrorCode(e.code);
            setError(e.message);
            setState(stateForCreateError(e.code));
            return;
          }
          setError(e instanceof Error ? e.message : 'Failed to request access');
          setState('error');
        }
      })();
    },
    [selection, deviceId, organizationId, applySettled],
  );

  // Decision delivery while awaiting: push subscription + polling fallback.
  const requestId = state === 'awaiting' || state === 'requesting' ? (request?.requestId ?? null) : null;
  useEffect(() => {
    if (!requestId) return undefined;
    const attempt = attemptRef.current;

    const unsubscribe = service.onDecision(requestId, settled => {
      if (attempt !== attemptRef.current) return;
      if (isSettledRequestStatus(settled.status)) applySettled(settled);
      else setRequest(settled);
    });

    const poll = setInterval(() => {
      service
        .get(requestId)
        .then(current => {
          if (attempt !== attemptRef.current) return;
          if (isSettledRequestStatus(current.status)) applySettled(current);
          else setRequest(current);
        })
        .catch(() => {
          // Transient poll failures are absorbed - the push channel and the
          // next tick both still stand.
        });
    }, POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [service, requestId, applySettled]);

  // The real API's push channel: REMOTE_ACCESS_DECISION on the technician's
  // notification subject (flat payload, no notification id - the notifications
  // drawer ignores it). Subscribed only while a real request is open; the
  // notifications bridge holds its own subscription on the same subject, which
  // NATS allows. Events for other requests are dropped; a repeated status is a
  // no-op, so dedup by requestId + status falls out of the merge.
  const decisionSubject =
    !isMock && requestId && userId ? `${NOTIFICATION_SUBJECT_PREFIX}.${userId}.${NOTIFICATION_SUBJECT_SUFFIX}` : null;
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);
  useNatsJsonSubscription<unknown>(
    decisionSubject,
    useCallback(
      payload => {
        const event = parseRemoteAccessDecisionEvent(payload);
        const current = requestRef.current;
        if (!event || !current || event.requestId !== current.requestId) return;
        if (process.env.NODE_ENV === 'development') {
          // Dev-only trace: the one way to tell the push from the 2 s poll when checking a backend.
          console.debug('[remote-access] decision push', event.status, event.decisionSource ?? '');
        }
        if (isSettledRequestStatus(current.status)) return;
        const merged = applyRemoteAccessDecisionEvent(current, event);
        if (isSettledRequestStatus(merged.status)) applySettled(merged);
        else setRequest(merged);
      },
      [applySettled],
    ),
  );

  const cancel = useCallback(() => {
    const open = request;
    attemptRef.current++;
    setState('idle');
    setRequest(null);
    setError(null);
    setErrorCode(null);
    setActive(null);
    if (open && !isSettledRequestStatus(open.status)) {
      service.revoke(open.requestId).catch(() => {
        // Best-effort: an already-settled request rejects the revoke (409 on
        // the real API) and there is nothing left to cancel.
      });
    }
  }, [service, request]);

  const reset = useCallback(() => {
    attemptRef.current++;
    setState('idle');
    setRequest(null);
    setError(null);
    setErrorCode(null);
    setActive(null);
  }, []);

  return { state, request, error, errorCode, isMock, requestAccess, cancel, reset };
}
