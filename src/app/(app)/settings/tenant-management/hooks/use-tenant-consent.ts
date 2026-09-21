'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/handle-api-error';
import type { TenantAccess } from '../types/tenant-connection';
import { accessStateTag, isReadable } from '../utils/tenant-presentation';
import { useCheckTenantConnection } from './use-tenant-connections';

export type ConsentCheckState = 'idle' | 'checking' | 'connected' | 'failed';

interface ConsentCheck {
  status: ConsentCheckState;
  /** The probe's answer, for the result tag; present for `connected` and for a refused `failed`. */
  result: TenantAccess | null;
  /** A transport failure (the probe never answered), for `failed` without a result. */
  error: string | null;
}

const IDLE: ConsentCheck = { status: 'idle', result: null, error: null };

/**
 * "Check Connection" — the one probe machine shared by the New page, the
 * details page of a not-yet-connected tenant and the Reconnect page. A probe is
 * a real restricted-scope read (there is no health endpoint on either
 * provider), so its outcome is whatever the directory answers: readable is
 * `connected`, a refusal is `failed` WITH the state that names who has to act,
 * and a transport error is `failed` without one. Every outcome except success
 * toasts; success is visible as the tag.
 *
 * Two guards keep late answers honest: an attempt counter drops a response that
 * belongs to an earlier click (or to a reset), and a mounted flag drops one that
 * lands after the user navigated away.
 */
export function useTenantConsent(connectionId: string | null | undefined) {
  const { toast } = useToast();
  const checkMutation = useCheckTenantConnection();
  const [check, setCheck] = useState<ConsentCheck>(IDLE);
  const attemptRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { mutateAsync } = checkMutation;

  const run = useCallback(async () => {
    // A click while a probe is in flight joins it: the button stays live-looking
    // (the frames draw it unchanged while the dots run) and must not start a second one.
    if (!connectionId || check.status === 'checking') return;
    const attempt = ++attemptRef.current;
    setCheck({ status: 'checking', result: null, error: null });
    try {
      const result = await mutateAsync(connectionId);
      if (!mountedRef.current || attempt !== attemptRef.current) return;
      if (isReadable(result.state)) {
        setCheck({ status: 'connected', result, error: null });
        return;
      }
      setCheck({ status: 'failed', result, error: null });
      toast({
        title: 'Connection check failed',
        description: result.reason || accessStateTag(result.state).label,
        variant: 'destructive',
      });
    } catch (error) {
      if (!mountedRef.current || attempt !== attemptRef.current) return;
      const message = getErrorMessage(error) || 'Could not check the connection.';
      setCheck({ status: 'failed', result: null, error: message });
      toast({ title: 'Connection check failed', description: message, variant: 'destructive' });
    }
  }, [connectionId, check.status, mutateAsync, toast]);

  /** Forget the last answer — the link changed (Edit Domain, Reconnect) so it no longer applies. */
  const reset = useCallback(() => {
    attemptRef.current += 1;
    setCheck(IDLE);
  }, []);

  return { ...check, isChecking: check.status === 'checking', check: run, reset };
}
