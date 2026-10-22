import { InfoCell } from './info-cell';

/* A "table-cell" card: 60px tall with 12px padding on mobile, 80px with 16px from md (`--spacing-system-m` carries
   exactly that 12->16 step). */
const POLICY_VALUE_CARD_CLASS =
  'flex min-h-[60px] items-center rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] content-md:min-h-20';

export interface PolicyValueCardProps {
  /** The field's name, fixed copy (drawn while loading too). */
  label: string;
  /** The policy's value; unread while loading (missing draws the bar). */
  value?: string | null;
  /** The value is inherited from the defaults: drawn in the secondary colour. */
  muted?: boolean;
  /** The value is not here yet. A loading scope does the same. */
  loading?: boolean;
}

/**
 * The read-only card that states one policy value (a guardrails preset, a remote access permission). One card for
 * the tenant defaults and the per-customer views; while loading, `InfoCell` draws the label real and the value a bar.
 */
export function PolicyValueCard({ label, value, muted = false, loading = false }: PolicyValueCardProps) {
  return (
    <div className={POLICY_VALUE_CARD_CLASS}>
      <InfoCell
        label={label}
        value={muted && value ? <span className="text-ods-text-secondary">{value}</span> : value}
        loading={loading || value == null}
        skeletonWidth="w-40 max-w-full"
      />
    </div>
  );
}
