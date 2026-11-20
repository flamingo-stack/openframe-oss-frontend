'use client';

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  DataTable,
  EntityImage,
  FloatingTooltip,
  SquareAvatar,
  Tag,
  type TagProps,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ClaimingCustomer } from '@/graphql/directory/customer-claim-fields';
import { EMPTY_VALUE } from '@/lib/empty-value';
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
  customers?: readonly ClaimingCustomer[];
  /** The tenant the first account is in; null for a user added in OpenFrame. */
  tenant?: { name: string; provider: string } | null;
  devices?: readonly string[];
  /** The account's direct groups, on a device's Users tab. */
  groups?: readonly string[];
  status?: { label: string; variant: TagProps['variant'] };
  statusTooltip?: string | null;
  lastSignIn?: string;
  /** Product names, one per SKU. */
  licenses?: readonly string[];
}

/** The provider marks in front of a name: which console the account lives in (brief). */
export function ProviderMarks({ providers }: { providers: readonly string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)]">
      {providers.map(provider => {
        const { Logo, label } = providerMark(provider);
        return <Logo key={provider} size={24} role="img" aria-label={label} />;
      })}
    </span>
  );
}

export function UserCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  const name = row.name ?? '';
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <SquareAvatar alt={name} fallback={name} size="sm" variant="round" loading={loading} />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <ProviderMarks providers={row.providers ?? []} />
          <TruncateText className={loading ? 'w-32' : undefined} triggerClassName="min-w-0 content-md:min-w-24">
            {name}
          </TruncateText>
          {row.roleTag && <Tag data-loading-optional label={row.roleTag} variant="grey" className="min-w-0" />}
        </div>
        <TruncateText variant="h6" tone="secondary" className={loading ? 'w-40' : undefined}>
          {row.email === null ? EMPTY_VALUE : (row.email ?? '')}
        </TruncateText>
      </div>
    </div>
  );
}

/**
 * USER column in the grid layout: one line. The avatar, the name, the role tag, then the address; the provider marks
 * close the line (the cell has one leading mark, and that is the avatar).
 */
export function UserGridCell({ row }: { row: UserRow }) {
  const name = row.name ?? '';
  const providers = row.providers ?? [];
  return (
    <DataTable.Cell
      leading={{ type: 'avatar', name }}
      // A row still being read has no name: the cell draws it as a bar.
      text={name}
      tag={row.roleTag ? <Tag label={row.roleTag} variant="grey" /> : undefined}
      secondary={row.email === undefined ? undefined : (row.email ?? EMPTY_VALUE)}
      trailing={providers.length > 0 && <ProviderMarks providers={providers} />}
    />
  );
}

/**
 * "Microsoft 365 E3 +3" (Figma 733:98943): the first name, the rest counted. A row's customers, devices, licences or
 * groups.
 */
export function FirstPlusCountCell({ names }: { names: readonly string[] | undefined }) {
  const loading = useLoadingScope();
  const { first, more } = firstAndCount(names ?? []);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <TruncateText loading={loading}>{first}</TruncateText>
      {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
    </div>
  );
}

export function CustomerCell({ row, showTenant = true }: { row: UserRow; showTenant?: boolean }) {
  const loading = useLoadingScope();
  const customers = row.customers ?? [];
  const firstCustomer = customers[0];
  // The customer's logo beside both lines (Figma 733:99095), the customers table's cell.
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      {(loading || firstCustomer) && (
        <EntityImage src={firstCustomer?.imageUrl} alt={firstCustomer?.name ?? ''} sizeClassName="size-12" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <FloatingTooltip
          disabled={customers.length === 0}
          triggerClassName="min-w-0"
          content={customers.map(customer => (
            <p key={customer.name}>{customer.claim ? `${customer.name} — ${customer.claim}` : customer.name}</p>
          ))}
        >
          <FirstPlusCountCell names={customers.map(customer => customer.name)} />
        </FloatingTooltip>
        {showTenant && (
          <TruncateText variant="h6" tone="secondary" loading={loading}>
            {row.tenant?.name ?? 'Added in OpenFrame'}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/**
 * CUSTOMER column in the grid layout: one line. The first customer's logo and name, the others behind `+N` (each with
 * the rule that brought it in, as the card's tooltip names them), then the tenant.
 */
export function CustomerGridCell({ row, showTenant = true }: { row: UserRow; showTenant?: boolean }) {
  const loading = useLoadingScope();
  // A row still being read: the logo's skeleton and the name as a bar.
  if (loading) return <DataTable.Cell leading={{ type: 'image', alt: '' }} text="" />;
  const [first, ...others] = row.customers ?? [];
  return (
    <DataTable.Cell
      leading={first && { type: 'image', src: first.imageUrl, alt: first.name }}
      text={first?.name ?? EMPTY_VALUE}
      moreTags={others.map(customer => (customer.claim ? `${customer.name} — ${customer.claim}` : customer.name))}
      secondary={showTenant ? (row.tenant?.name ?? 'Added in OpenFrame') : undefined}
    />
  );
}

export function StatusCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col items-start justify-center">
      <FloatingTooltip content={row.statusTooltip} disabled={!row.statusTooltip} as="span">
        <Tag label={row.status?.label ?? ''} variant={row.status?.variant} loading={loading} />
      </FloatingTooltip>
      {/* A phone shows the tag alone (Figma 907:31981). */}
      <div className="hidden w-full min-w-0 content-md:block">
        <TruncateText variant="h6" tone="secondary" loading={loading}>
          {`Last sign-in: ${row.lastSignIn ?? 'Never'}`}
        </TruncateText>
      </div>
    </div>
  );
}

/** STATUS column in the grid layout: one line, the tag with the last sign-in after it. */
export function StatusGridCell({ row }: { row: UserRow }) {
  const loading = useLoadingScope();
  return (
    <DataTable.Cell
      tag={
        <FloatingTooltip content={row.statusTooltip} disabled={!row.statusTooltip} as="span">
          <Tag label={row.status?.label ?? ''} variant={row.status?.variant} loading={loading} />
        </FloatingTooltip>
      }
      // While the row is read there is no sign-in to print: the tag's own skeleton is the cell.
      secondary={loading ? undefined : `Last sign-in: ${row.lastSignIn ?? 'Never'}`}
    />
  );
}
