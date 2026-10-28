'use client';

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  FloatingTooltip,
  SquareAvatar,
  Tag,
  type TagProps,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { firstAndCount } from '../../utils/user-presentation';

/**
 * One Users row as its cells read it. Every field but `id` is optional: while the page is read the table draws its
 * placeholder rows (`{ id }` only) with these same cells, each part switching itself in the loading scope.
 */
export interface UserRow {
  id: string;
  href?: string | null;
  name?: string;
  email?: string | null;
  providers?: readonly string[];
  /** "Global admin" / "Super admin", or null. */
  roleTag?: string | null;
  service?: boolean;
  customers?: readonly UserRowCustomer[];
  /** The tenant the first account is in; null for a user added in OpenFrame. */
  tenant?: { name: string; provider: string } | null;
  devices?: readonly string[];
  status?: { label: string; variant: TagProps['variant'] };
  statusTooltip?: string | null;
  lastSignIn?: string;
  /** Product names, one per SKU. */
  licenses?: readonly string[];
}

export interface UserRowCustomer {
  name: string;
  imageUrl?: string;
  /** Which rule brought the customer in ("Group: Finance"), or null when the user was added to it directly. */
  claim: string | null;
}

/** The provider marks in front of a name: which console the account lives in (brief). */
function ProviderMarks({ providers }: { providers: readonly string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)]">
      {providers.map(provider => {
        const { Logo, label } = providerMark(provider);
        return <Logo key={provider} size={16} role="img" aria-label={label} />;
      })}
    </span>
  );
}

export function UserCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const name = row.name ?? '';
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <SquareAvatar alt={name} fallback={name} size="sm" variant="round" loading={loading} />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <ProviderMarks providers={row.providers ?? []} />
          <TruncateText className={loading ? 'w-32' : undefined} triggerClassName="min-w-24">
            {name}
          </TruncateText>
          {row.roleTag && <Tag data-loading-optional label={row.roleTag} variant="grey" className="min-w-0" />}
          {row.service && <Tag data-loading-optional label="Service" variant="grey" className="min-w-0" />}
        </div>
        <TruncateText variant="h6" tone="secondary" className={loading ? 'w-40' : undefined}>
          {row.email ?? ''}
        </TruncateText>
      </div>
    </div>
  );
}

export function CustomerCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const customers = row.customers ?? [];
  const { first, more } = firstAndCount(customers.map(customer => customer.name));
  const firstCustomer = customers[0];
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <FloatingTooltip
        disabled={customers.length === 0}
        triggerClassName="min-w-0"
        content={customers.map(customer => (
          <p key={customer.name}>{customer.claim ? `${customer.name} — ${customer.claim}` : customer.name}</p>
        ))}
      >
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          {firstCustomer && (
            <SquareAvatar
              data-loading-optional
              src={firstCustomer.imageUrl}
              alt={firstCustomer.name}
              fallback={firstCustomer.name}
              size="xs"
              variant="square"
            />
          )}
          <TruncateText loading={loading}>{first}</TruncateText>
          {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
        </div>
      </FloatingTooltip>
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <ProviderMarks providers={row.tenant ? [row.tenant.provider] : []} />
        <TruncateText variant="h6" tone="secondary" loading={loading}>
          {row.tenant?.name ?? 'Added in OpenFrame'}
        </TruncateText>
      </div>
    </div>
  );
}

export function DevicesCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const { first, more } = firstAndCount(row.devices ?? []);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <TruncateText loading={loading}>{first}</TruncateText>
      {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
    </div>
  );
}

/** "Microsoft 365 E3 +3" (Figma 733:98943): the first licence, the rest counted. */
export function LicensesCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const { first, more } = firstAndCount(row.licenses ?? []);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <TruncateText loading={loading}>{first}</TruncateText>
      {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
    </div>
  );
}

export function StatusCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <FloatingTooltip content={row.statusTooltip} disabled={!row.statusTooltip} as="span">
        <Tag label={row.status?.label ?? ''} variant={row.status?.variant} loading={loading} />
      </FloatingTooltip>
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {`Last sign-in: ${row.lastSignIn ?? 'Never'}`}
      </TruncateText>
    </div>
  );
}
