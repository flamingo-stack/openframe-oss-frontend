import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

// Static "Test mode" banner. Shared by the live view and its loading skeleton so
// the copy/chrome are defined once.
export function TestModeBanner() {
  return (
    <div className="flex items-start gap-[var(--spacing-system-s)] rounded-md bg-[var(--ods-open-yellow-base)] p-[var(--spacing-system-s)] text-ods-text-on-accent">
      <AlertTriangleIcon className="size-6 shrink-0" />
      <p className="flex-1 font-bold text-h3">
        Test mode — invoices and usage shown here are samples. No real charges are being made.
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

export function BillingRow({
  label,
  value,
  muted = false,
  warning = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  warning?: boolean;
}) {
  const valueClass = warning ? 'text-ods-warning' : muted ? 'text-ods-text-secondary' : 'text-ods-text-primary';
  return (
    <div className="flex w-full items-center gap-2">
      <span className="whitespace-nowrap text-ods-text-primary text-h4">{label}</span>
      <div className="h-px min-w-4 flex-1 bg-ods-border" />
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-h4', valueClass)}>{value}</span>
    </div>
  );
}
