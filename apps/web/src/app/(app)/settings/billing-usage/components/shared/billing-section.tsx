import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertTriangleIcon, InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';

// The "Test mode" banner, until `billing-live-mode` is on. Drawn the same while the
// page loads, so the copy/chrome are defined once. Nothing until the
// flag answers: a live account must never flash "no real charges".
export function TestModeBanner() {
  const gate = useFeatureFlagGate('billing-live-mode');
  if (gate !== 'off') return null;

  return (
    <div className="flex items-start gap-[var(--spacing-system-s)] rounded-md bg-[var(--ods-open-yellow-base)] p-[var(--spacing-system-s)] text-ods-text-on-accent">
      <AlertTriangleIcon className="size-6 shrink-0" />
      <p className="flex-1 font-bold text-h3">
        Test mode — invoices and usage shown here are samples. No real charges are being made.
      </p>
    </div>
  );
}

/**
 * The desktop build's line over its read-only billing page: said out loud, because a billing page with no way to
 * change anything otherwise reads as a broken build.
 */
export function BillingReadOnlyNotice() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xsf)]">
      <InfoCircleIcon className="size-6 shrink-0 text-ods-accent" />
      <p className="text-ods-text-secondary text-h4">
        Billing and payments are managed in the browser. Manage Billing opens your workspace's billing page there.
      </p>
    </div>
  );
}

export function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-1">
      <p className="uppercase tracking-[-0.02em] text-ods-text-secondary text-h5">{title}</p>
      <div className="flex flex-1 flex-col gap-3 rounded-md border border-ods-border bg-ods-card p-4">{children}</div>
    </div>
  );
}

const ROW_CLASS = 'flex w-full items-center gap-2';
const LABEL_CLASS = 'whitespace-nowrap text-ods-text-primary text-h4';
const LEADER_CLASS = 'h-px min-w-4 flex-1 bg-ods-border';

/** A row while its value is on its way: the label is fixed copy and stays real, the value is a bar. */
export function BillingRowSkeleton({ label }: { label: string }) {
  return (
    <div className={ROW_CLASS}>
      <span className={LABEL_CLASS}>{label}</span>
      <div className={LEADER_CLASS} />
      <TextLineSkeleton as="span" type="h4" className="w-16" />
    </div>
  );
}

export function BillingRow({
  label,
  value,
  muted = false,
  warning = false,
  loading = false,
}: {
  label: string;
  /** Unread while loading. */
  value?: React.ReactNode;
  muted?: boolean;
  warning?: boolean;
  /** Its value has not answered: the row draws its own skeleton (as it does in a loading scope). */
  loading?: boolean;
}) {
  if (useLoadingScope() || loading) return <BillingRowSkeleton label={label} />;
  const valueClass = warning ? 'text-ods-warning' : muted ? 'text-ods-text-secondary' : 'text-ods-text-primary';
  return (
    <div className={ROW_CLASS}>
      <span className={LABEL_CLASS}>{label}</span>
      <div className={LEADER_CLASS} />
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-h4', valueClass)}>{value}</span>
    </div>
  );
}
