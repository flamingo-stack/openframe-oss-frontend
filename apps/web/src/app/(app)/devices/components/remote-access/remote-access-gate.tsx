'use client';

import { Button, NoData, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { Loading01Icon, ScanXmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRemoteAccessApproval } from '../../hooks/use-remote-access-approval';
import { useRemoteAccessApprovalGate } from '../../hooks/use-remote-access-approval-gate';
import { useRemoteSession } from '../../hooks/use-remote-session';
import { RemoteAccessSessionProvider } from './remote-access-session-context';

interface RemoteAccessGateProps {
  deviceId: string;
  /** Hostname when known - used in the copy; falls back to "this device". */
  deviceName?: string;
  /**
   * Optional context for the request (a reason is never required) - e.g.
   * prefilled when the technician connects from a ticket.
   */
  reason?: string;
  /** Leave the flow entirely (the pages' safe-back). */
  onBack: () => void;
  /** The actual session surface - mounted ONLY once the request is approved. */
  children: ReactNode;
}

/** mm:ss until `expiresAt`, floored at zero. */
function formatRemaining(expiresAt: string, nowMs: number): string {
  const remaining = Math.max(0, Math.floor((Date.parse(expiresAt) - nowMs) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Approval gate for the remote screen (MeshCentral desktop) page: the
 * session component in `children` mounts only after the
 * end user approves, so no tunnel effect can fire early. Until then this
 * renders the flow's own page - awaiting (with countdown + cancel), denied /
 * timed out / error. The request fires on mount: there is no reason step (a
 * reason is never required), and the server resolves the policy inside create.
 *
 * Remote shell and file manager are outside the epic's scope and are not
 * gated - the wire `sessionKind` is always 'desktop'.
 *
 * With the `remote-access-approval` flag off it renders children directly -
 * the legacy auto-start behavior, byte for byte.
 *
 * No dedicated mockups exist for these states (noted on the task) - built from
 * the app's existing overlay/empty-state patterns; the designer pass can
 * restyle without touching the flow.
 */
export function RemoteAccessGate({ deviceId, deviceName, reason, onBack, children }: RemoteAccessGateProps) {
  const gate = useRemoteAccessApprovalGate();
  const approval = useRemoteAccessApproval(deviceId);

  // The policy decides the flow shape on the server: DENY_ACCESS answers
  // DENIED with the mode recorded, NOTIFY_ONLY / SILENT_ACCESS approve at
  // once, APPROVAL_REQUIRED waits for the end user.
  const policyDenied = approval.request?.status === 'DENIED' && approval.request.mode === 'DENY_ACCESS';

  // Nothing to type - fire the request as soon as the gate is on. Keyed
  // off `state === 'idle'` rather than a one-shot flag: StrictMode's dev
  // effect replay aborts the first in-flight create (the hook's attempt
  // guard), and a flag would then block the retry forever. The
  // idle->requesting transition is what prevents loops; the suppress ref
  // covers the one idle that must NOT re-request - cancelling out of the flow
  // (the awaiting screen navigates back right after).
  const suppressAutoRef = useRef(false);
  useEffect(() => {
    if (gate !== 'on' || policyDenied) return;
    if (approval.state !== 'idle' || suppressAutoRef.current) return;
    approval.requestAccess(reason);
  }, [gate, policyDenied, reason, approval]);

  // One ticking clock for the awaiting countdown.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const awaiting = approval.state === 'awaiting';
  useEffect(() => {
    if (!awaiting) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [awaiting]);

  // Back to idle, and the auto-request above sends a new request. Also the
  // Retry of a session that never connected: a new request, a new session.
  const handleRetry = () => {
    suppressAutoRef.current = false;
    approval.reset();
  };

  if (gate === 'off') return <>{children}</>;
  if (gate === 'loading') return <CompactPageLoader />;
  if (approval.state === 'approved') {
    return (
      <ApprovedSessionScope
        deviceId={deviceId}
        requestId={approval.request?.requestId ?? null}
        onRequestAgain={handleRetry}
      >
        {children}
      </ApprovedSessionScope>
    );
  }

  const target = deviceName || 'this device';

  let body: ReactNode;
  if (policyDenied) {
    // Designer decision: DENY_ACCESS disables the entry points in place; this
    // screen only exists for direct URLs, which never passed through a menu.
    body = (
      <NoData
        icon={<ScanXmarkIcon />}
        title="Remote access disabled"
        description="The remote access policy for this device does not allow remote connections."
        button={
          <Button type="button" variant="outline" onClick={onBack}>
            Back to Device Details
          </Button>
        }
      />
    );
  } else if (approval.state === 'idle' || approval.state === 'requesting') {
    // Auto-request in flight (NOTIFY/SILENT settle instantly; APPROVAL_REQUIRED
    // proceeds to the awaiting screen).
    body = <Loading01Icon className="h-8 w-8 animate-spin text-ods-text-secondary" />;
  } else if (approval.state === 'awaiting') {
    const request = approval.request;
    body = (
      <>
        <Loading01Icon className="h-8 w-8 animate-spin text-ods-text-secondary" />
        <div className="flex flex-col items-center gap-[var(--spacing-system-xxs)] text-center">
          <h2 className="text-ods-text-primary text-h3">Waiting for approval</h2>
          <p className="text-ods-text-secondary text-h6">
            {request?.status === 'DELIVERED'
              ? `The request is on the user's screen - waiting for their answer.`
              : `Sending the request to ${target}...`}
          </p>
          {request && (
            <p className="text-ods-text-muted text-h6">Expires in {formatRemaining(request.expiresAt, nowMs)}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={() => {
            approval.cancel();
            // There is no screen behind the cancel - leave the flow instead
            // of auto-requesting again.
            suppressAutoRef.current = true;
            onBack();
          }}
        >
          Cancel Request
        </Button>
      </>
    );
  } else if (approval.state === 'denied') {
    // "Access declined" mockup (1036-31838): a single way out, no retry - the
    // technician asks again by starting over from the device page. The copy
    // tells a user's Decline from the policy fallback (no client to ask, or no
    // answer, with the fallback set to Deny) without a GET - decisionSource
    // comes with the decision event / the request object.
    const fallback = approval.request?.decisionSource === 'FALLBACK';
    body = (
      <NoData
        icon={<ScanXmarkIcon />}
        title="Remote access declined"
        description={
          fallback
            ? `Nobody on ${target} could answer the request, and the remote access policy denies access in that case.`
            : 'The user declined your remote access request.'
        }
        button={
          <Button type="button" variant="outline" onClick={onBack}>
            Back to Device Details
          </Button>
        }
      />
    );
  } else {
    // timed_out / busy / unreachable / error: no dedicated mockups - same
    // placeholder pattern as the declined and connection-failed screens, with
    // a Retry.
    const copy =
      approval.state === 'timed_out'
        ? {
            title: 'No response',
            description: `Nobody answered the request on ${target} before it expired.`,
          }
        : approval.state === 'busy'
          ? {
              title: 'Device is busy',
              description:
                approval.errorCode === 'DEVICE_HAS_ACTIVE_SESSION'
                  ? `Another technician has an active remote session on ${target}. Try again once it ends.`
                  : `Another technician is waiting for approval on ${target}. Try again in a moment.`,
            }
          : approval.state === 'unreachable'
            ? {
                title: "Couldn't reach the device",
                description: `The request could not be delivered to ${target}. Nothing was sent, so it is safe to retry.`,
              }
            : {
                title: 'Request failed',
                description: approval.error ?? 'Something went wrong while requesting access.',
              };
    body = (
      <NoData
        icon={<ScanXmarkIcon />}
        title={copy.title}
        description={copy.description}
        button={
          <div className="flex items-stretch gap-[var(--spacing-system-mf)]">
            <Button type="button" variant="outline" onClick={onBack}>
              Back to Device Details
            </Button>
            <Button type="button" variant="accent" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <PageLayout
      className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: onBack }}
    >
      {/* Black canvas panel like the session surface itself - the state
          mockups draw every flow state inside it. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-lg bg-black">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-[var(--spacing-system-mf)] p-[var(--spacing-system-l)]">
          {body}
        </div>
      </div>
    </PageLayout>
  );
}

/**
 * Mounted for the approved session only: resolves the backend session record
 * behind the request (its id ends the session, its dialog id feeds the chat)
 * and hands it to the surface.
 */
function ApprovedSessionScope({
  deviceId,
  requestId,
  onRequestAgain,
  children,
}: {
  deviceId: string;
  requestId: string | null;
  onRequestAgain: () => void;
  children: ReactNode;
}) {
  const { session, ended, endSession } = useRemoteSession(deviceId, requestId);
  const value = useMemo(
    () => ({ requestId, session, ended, endSession, requestAgain: onRequestAgain }),
    [requestId, session, ended, endSession, onRequestAgain],
  );
  return <RemoteAccessSessionProvider value={value}>{children}</RemoteAccessSessionProvider>;
}
