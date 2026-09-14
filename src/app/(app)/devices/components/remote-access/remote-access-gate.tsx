'use client';

import { Button, NoData, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import {
  ComputerMouseIcon,
  FolderIcon,
  ScanXmarkIcon,
  TerminalIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CompactPageLoader, Label, Textarea } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Loader2 } from 'lucide-react';
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from 'react';
import { useRemoteAccessApproval } from '../../hooks/use-remote-access-approval';
import { useRemoteAccessApprovalGate } from '../../hooks/use-remote-access-approval-gate';
import { useEffectiveDeviceRemoteAccessMode, useTenantRemoteAccessPolicy } from '../../hooks/use-remote-access-policy';
import { mockRemoteAccessDecision } from '../../services/remote-access-approval-service';
import type { RemoteSessionKind } from '../../types/remote-access';

interface RemoteAccessGateProps {
  deviceId: string;
  /** Hostname when known - used in the copy; falls back to "this device". */
  deviceName?: string;
  /**
   * Pass when known: the mock policy resolution needs it for the per-customer
   * override to apply (the real API derives it server-side).
   */
  organizationId?: string;
  sessionKind: RemoteSessionKind;
  /** Leave the flow entirely (the pages' safe-back). */
  onBack: () => void;
  /** The actual session surface - mounted ONLY once the request is approved. */
  children: ReactNode;
}

const SESSION_KIND_META: Record<RemoteSessionKind, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  desktop: { label: 'Remote Control', Icon: ComputerMouseIcon },
  shell: { label: 'Remote Shell', Icon: TerminalIcon },
  files: { label: 'File Manager', Icon: FolderIcon },
};

/** mm:ss until `expiresAt`, floored at zero. */
function formatRemaining(expiresAt: string, nowMs: number): string {
  const remaining = Math.max(0, Math.floor((Date.parse(expiresAt) - nowMs) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Approval gate for every MeshCentral surface (CU-86ajx03db): the session
 * component in `children` mounts only after the end user approves, so no
 * tunnel effect can fire early. Until then this renders the flow's own page -
 * reason step, awaiting (with countdown + cancel), denied / timed out / error.
 *
 * With the `remote-access-approval` flag off it renders children directly -
 * the legacy auto-start behavior, byte for byte.
 *
 * No dedicated mockups exist for these states (noted on the task) - built from
 * the app's existing overlay/empty-state patterns; the designer pass can
 * restyle without touching the flow.
 */
export function RemoteAccessGate({
  deviceId,
  deviceName,
  organizationId,
  sessionKind,
  onBack,
  children,
}: RemoteAccessGateProps) {
  const gate = useRemoteAccessApprovalGate();
  const approval = useRemoteAccessApproval(deviceId, sessionKind, organizationId);
  const [reason, setReason] = useState('');

  // Policy sync (CU-86akeqw8b): the effective mode decides the flow shape -
  // DENY_ACCESS never requests, NOTIFY_ONLY / SILENT_ACCESS auto-approve on
  // the service side - and `reasonRequired` decides whether the reason step
  // exists at all.
  const effectiveMode = useEffectiveDeviceRemoteAccessMode({ machineId: deviceId, id: deviceId, organizationId });
  const tenantPolicy = useTenantRemoteAccessPolicy({ enabled: gate === 'on' });
  const policyLoading = gate === 'on' && (effectiveMode === undefined || tenantPolicy.isLoading);
  // Conservative until loaded: showing the reason step needlessly is harmless,
  // silently skipping a required one is not.
  const reasonRequired = tenantPolicy.data?.reasonRequired ?? true;
  // Either the policy read says DENY up front, or a create raced a policy
  // change and came back DENIED with the resolved mode recorded.
  const policyDenied = effectiveMode === 'DENY_ACCESS' || approval.request?.resolvedMode === 'DENY_ACCESS';

  // With no reason step there is nothing to type - fire the request as soon
  // as the policy is known. Keyed off `state === 'idle'` rather than a
  // one-shot flag: StrictMode's dev effect replay aborts the first in-flight
  // create (the hook's attempt guard), and a flag would then block the retry
  // forever. The idle->requesting transition is what prevents loops; the
  // suppress ref covers the one idle that must NOT re-request - cancelling
  // out of the flow (the awaiting screen navigates back right after).
  const suppressAutoRef = useRef(false);
  useEffect(() => {
    if (gate !== 'on' || policyLoading || policyDenied || reasonRequired) return;
    if (approval.state !== 'idle' || suppressAutoRef.current) return;
    approval.requestAccess('');
  }, [gate, policyLoading, policyDenied, reasonRequired, approval]);

  // One ticking clock for the awaiting countdown.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const awaiting = approval.state === 'awaiting';
  useEffect(() => {
    if (!awaiting) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [awaiting]);

  if (gate === 'off') return <>{children}</>;
  if (gate === 'loading') return <CompactPageLoader />;
  if (approval.state === 'approved') return <>{children}</>;

  const { label, Icon } = SESSION_KIND_META[sessionKind];
  const target = deviceName || 'this device';

  const handleRetry = () => {
    suppressAutoRef.current = false;
    approval.reset();
  };

  let body: ReactNode;
  if (policyLoading) {
    body = <Loader2 className="h-8 w-8 animate-spin text-ods-text-secondary" />;
  } else if (policyDenied) {
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
  } else if ((approval.state === 'idle' || approval.state === 'requesting') && !reasonRequired) {
    // Auto-request in flight (NOTIFY/SILENT settle instantly; APPROVAL_REQUIRED
    // proceeds to the awaiting screen without a reason step).
    body = <Loader2 className="h-8 w-8 animate-spin text-ods-text-secondary" />;
  } else if (approval.state === 'idle' || approval.state === 'requesting') {
    body = (
      <>
        <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
          <Icon className="h-6 w-6 text-ods-text-primary" />
        </div>
        <div className="flex flex-col items-center gap-[var(--spacing-system-xxs)] text-center">
          <h2 className="text-ods-text-primary text-h3">Request Remote Access</h2>
          <p className="text-ods-text-secondary text-h6">
            {label} needs the user's permission - they will see who is connecting and can allow or decline.
          </p>
        </div>
        <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)]">
          <Label htmlFor="remote-access-reason">Reason</Label>
          <Textarea
            id="remote-access-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why are you connecting? The user will see this."
            rows={3}
          />
        </div>
        <div className="flex w-full items-stretch gap-[var(--spacing-system-mf)]">
          <Button type="button" variant="outline" fullWidth onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            variant="accent"
            fullWidth
            loading={approval.state === 'requesting'}
            // The step only renders when the policy requires a reason.
            disabled={reason.trim() === ''}
            onClick={() => approval.requestAccess(reason.trim())}
          >
            Request Access
          </Button>
        </div>
      </>
    );
  } else if (approval.state === 'awaiting') {
    const request = approval.request;
    body = (
      <>
        <Loader2 className="h-8 w-8 animate-spin text-ods-text-secondary" />
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
            // Without a reason step there is no screen behind the cancel -
            // leave the flow instead of auto-requesting again.
            if (!reasonRequired) {
              suppressAutoRef.current = true;
              onBack();
            }
          }}
        >
          Cancel Request
        </Button>
        {process.env.NODE_ENV === 'development' && request && (
          <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)] rounded-md border border-dashed border-ods-border p-[var(--spacing-system-sf)]">
            <span className="text-ods-text-muted text-h6">Dev only - simulate the end user's decision</span>
            <div className="flex items-stretch gap-[var(--spacing-system-xsf)]">
              <Button
                type="button"
                variant="outline"
                size="small"
                fullWidth
                onClick={() => mockRemoteAccessDecision(request.requestId, 'APPROVED')}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="small"
                fullWidth
                onClick={() => mockRemoteAccessDecision(request.requestId, 'DENIED')}
              >
                Deny
              </Button>
              <Button
                type="button"
                variant="outline"
                size="small"
                fullWidth
                onClick={() => mockRemoteAccessDecision(request.requestId, 'TIMED_OUT')}
              >
                Timeout
              </Button>
            </div>
          </div>
        )}
      </>
    );
  } else if (approval.state === 'denied') {
    // "Access declined" mockup (1036-31838): a single way out, no retry - the
    // technician asks again by starting over from the device page.
    body = (
      <NoData
        icon={<ScanXmarkIcon />}
        title="Remote access declined"
        description="The user declined your remote access request."
        button={
          <Button type="button" variant="outline" onClick={onBack}>
            Back to Device Details
          </Button>
        }
      />
    );
  } else {
    // timed_out / error: no dedicated mockups - same placeholder pattern as
    // the declined and connection-failed screens, with a Retry.
    const copy =
      approval.state === 'timed_out'
        ? {
            title: 'No response',
            description: `Nobody answered the request on ${target} before it expired.`,
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
