'use client';

import { Button, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import {
  ComputerMouseIcon,
  FolderIcon,
  TerminalIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { CompactPageLoader, Label, Textarea } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Loader2 } from 'lucide-react';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';
import { useRemoteAccessApproval } from '../../hooks/use-remote-access-approval';
import { useRemoteAccessApprovalGate } from '../../hooks/use-remote-access-approval-gate';
import { mockRemoteAccessDecision } from '../../services/remote-access-approval-service';
import type { RemoteSessionKind } from '../../types/remote-access';

interface RemoteAccessGateProps {
  deviceId: string;
  /** Hostname when known - used in the copy; falls back to "this device". */
  deviceName?: string;
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
export function RemoteAccessGate({ deviceId, deviceName, sessionKind, onBack, children }: RemoteAccessGateProps) {
  const gate = useRemoteAccessApprovalGate();
  const approval = useRemoteAccessApproval(deviceId, sessionKind);
  const [reason, setReason] = useState('');

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

  let body: ReactNode;
  if (approval.state === 'idle' || approval.state === 'requesting') {
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
        <Button type="button" variant="outline" fullWidth onClick={approval.cancel}>
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
  } else {
    const copy =
      approval.state === 'denied'
        ? {
            title: 'Access declined',
            description: `The user declined the ${label.toLowerCase()} request. You can ask again or go back.`,
          }
        : approval.state === 'timed_out'
          ? {
              title: 'No response',
              description: `Nobody answered the request on ${target} before it expired.`,
            }
          : {
              title: 'Request failed',
              description: approval.error ?? 'Something went wrong while requesting access.',
            };
    body = (
      <>
        <div className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
          <Icon className="h-6 w-6 text-ods-text-secondary" />
        </div>
        <div className="flex flex-col items-center gap-[var(--spacing-system-xxs)] text-center">
          <h2 className="text-ods-text-primary text-h3">{copy.title}</h2>
          <p className="text-ods-text-secondary text-h6">{copy.description}</p>
        </div>
        <div className="flex w-full items-stretch gap-[var(--spacing-system-mf)]">
          <Button type="button" variant="outline" fullWidth onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="accent" fullWidth onClick={approval.reset}>
            Try Again
          </Button>
        </div>
      </>
    );
  }

  return (
    <PageLayout
      className="h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: onBack }}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-[var(--spacing-system-mf)]">{body}</div>
      </div>
    </PageLayout>
  );
}
