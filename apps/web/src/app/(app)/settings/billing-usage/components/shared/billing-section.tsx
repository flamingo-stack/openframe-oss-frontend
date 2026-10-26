import { AlertTriangleIcon, InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LeaderRow, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';

// The "Test mode" banner, until `billing-live-mode` is on. Nothing until the flag answers: a live account must never
// flash "no real charges". Only test accounts have it, so it sits below the page's sections and is marked
// `data-loading-optional`: appearing never moves them.
export function TestModeBanner() {
  const gate = useFeatureFlagGate('billing-live-mode');
  if (gate !== 'off') return null;

  return (
    <div
      data-loading-optional
      className="flex items-start gap-[var(--spacing-system-s)] rounded-md bg-[var(--ods-open-yellow-base)] p-[var(--spacing-system-s)] text-ods-text-on-accent"
    >
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

/** A billing summary row: the label as body copy, a leader line, the value (the lib's `LeaderRow`). */
export function BillingRow({
  label,
  value,
  muted = false,
  warning = false,
  loading = false,
  optional = false,
}: {
  label: string;
  /** Unread while loading. */
  value?: React.ReactNode;
  muted?: boolean;
  warning?: boolean;
  /** Its value has not answered: the row draws its own skeleton (as it does in a loading scope). */
  loading?: boolean;
  /** Only some records have this row: it is left out while loading and marked `data-loading-optional`. */
  optional?: boolean;
}) {
  return (
    <LeaderRow
      label={label}
      value={value}
      labelTone="primary"
      valueTone={warning ? 'warning' : muted ? 'secondary' : 'primary'}
      // Every row's value is read data: in a page's loading scope it is a bar even where a value was passed.
      loading={useLoadingScope() || loading}
      data-loading-optional={optional || undefined}
    />
  );
}
