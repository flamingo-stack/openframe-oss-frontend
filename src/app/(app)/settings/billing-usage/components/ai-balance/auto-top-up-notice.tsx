'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { AutoTopUpStatus } from './auto-top-up-status';

interface AutoTopUpNoticeProps {
  status: AutoTopUpStatus;
  /** Opens Manage AI Balance; `null` on a build that changes nothing. */
  onManage: (() => void) | null;
}

/**
 * The system switched auto top-up off: the card declined an automatic charge,
 * and one charge is one outcome — it is never retried. Said on the page under
 * the balance it stopped refilling, because the only other place the tenant
 * would learn it is the silence of an assistant that stopped answering once
 * that balance ran dry.
 */
export function AutoTopUpNotice({ status, onManage }: AutoTopUpNoticeProps) {
  if (!status.paymentFailed) return null;

  return (
    <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-m)]">
      <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
      <div className="flex min-w-[16rem] flex-1 flex-col">
        <p className="font-bold text-ods-text-primary text-h3">Auto top-up is switched off.</p>
        <p className="text-ods-text-secondary text-h4">
          The last automatic charge was declined, so your balance no longer refills itself. Update your card in the
          Customer Portal, then turn auto top-up back on.
        </p>
      </div>
      {onManage && (
        <Button variant="outline" onClick={onManage}>
          Manage AI Balance
        </Button>
      )}
    </div>
  );
}
