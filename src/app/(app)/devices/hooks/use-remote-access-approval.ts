'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSettledRequestStatus, remoteAccessApprovalService } from '../services/remote-access-approval-service';
import type { RemoteAccessRequest, RemoteSessionKind } from '../types/remote-access';

/**
 * The technician-side view of one approval attempt:
 * idle -> requesting -> awaiting -> approved | denied | timed_out | error;
 * `cancel` revokes an awaiting request and returns to idle, `reset` returns
 * from any settled state to idle (the retry affordance).
 */
export type RemoteAccessApprovalState =
  'idle' | 'requesting' | 'awaiting' | 'approved' | 'denied' | 'timed_out' | 'error';

export interface UseRemoteAccessApprovalResult {
  state: RemoteAccessApprovalState;
  request: RemoteAccessRequest | null;
  error: string | null;
  requestAccess: (reason: string) => void;
  /** Revoke the open request (technician cancel) and go back to the reason step. */
  cancel: () => void;
  /** From denied/timed_out/error back to the reason step. */
  reset: () => void;
}

function stateForSettled(request: RemoteAccessRequest): RemoteAccessApprovalState {
  switch (request.status) {
    case 'APPROVED':
      return 'approved';
    case 'DENIED':
      return 'denied';
    case 'TIMED_OUT':
      return 'timed_out';
    // REVOKED is only ever this technician's own cancel - land back on the
    // reason step rather than a dead end.
    case 'REVOKED':
      return 'idle';
    default:
      return 'awaiting';
  }
}

/** Poll interval for the decision fallback (the push channel is the fast path). */
const POLL_MS = 5_000;

export function useRemoteAccessApproval(
  deviceId: string,
  sessionKind: RemoteSessionKind,
): UseRemoteAccessApprovalResult {
  const [state, setState] = useState<RemoteAccessApprovalState>('idle');
  const [request, setRequest] = useState<RemoteAccessRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    (reason: string) => {
      const attempt = ++attemptRef.current;
      setError(null);
      setState('requesting');
      (async () => {
        try {
          const created = await remoteAccessApprovalService.create({ deviceId, sessionKind, reason });
          if (attempt !== attemptRef.current) return;
          setRequest(created);
          if (isSettledRequestStatus(created.status)) {
            applySettled(created);
            return;
          }
          setState('awaiting');
        } catch (e) {
          if (attempt !== attemptRef.current) return;
          setError(e instanceof Error ? e.message : 'Failed to request access');
          setState('error');
        }
      })();
    },
    [deviceId, sessionKind, applySettled],
  );

  // Decision delivery while awaiting: push subscription + polling fallback.
  const requestId = state === 'awaiting' || state === 'requesting' ? (request?.requestId ?? null) : null;
  useEffect(() => {
    if (!requestId) return undefined;
    const attempt = attemptRef.current;

    const unsubscribe = remoteAccessApprovalService.onDecision(requestId, settled => {
      if (attempt !== attemptRef.current) return;
      if (isSettledRequestStatus(settled.status)) applySettled(settled);
      else setRequest(settled);
    });

    const poll = setInterval(() => {
      remoteAccessApprovalService
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
  }, [requestId, applySettled]);

  const cancel = useCallback(() => {
    const open = request;
    attemptRef.current++;
    setState('idle');
    setRequest(null);
    setError(null);
    if (open && !isSettledRequestStatus(open.status)) {
      remoteAccessApprovalService.revoke(open.requestId).catch(() => {
        // Best-effort: an already-settled request rejects the revoke (409 on
        // the real API) and there is nothing left to cancel.
      });
    }
  }, [request]);

  const reset = useCallback(() => {
    attemptRef.current++;
    setState('idle');
    setRequest(null);
    setError(null);
  }, []);

  return { state, request, error, requestAccess, cancel, reset };
}
