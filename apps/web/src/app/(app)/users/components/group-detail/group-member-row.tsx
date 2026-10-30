'use client';

import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { CustomerCell, ProviderMarks, UserCell, type UserRow } from '../users-list/user-row-cells';

export type MemberKind = 'user' | 'group' | 'device';

const MEMBER_TYPE: Record<MemberKind, string> = { user: 'User', group: 'Group', device: 'Device' };

/** One member as the cells read it: a user draws as on the Users list. Every field but `id` is absent on a loading row. */
export interface MemberRow extends UserRow {
  kind?: MemberKind;
  /** The second line of a group or a device ("Security group, nested", "Entra device"). */
  detail?: string;
  /** Nested members only: the group the member comes through, when the provider says it. */
  via?: string | null;
}

/** A group or a device: no avatar and no email, so the avatar's slot keeps the names in line (Figma 733:99325). */
function RecordCell({ row }: { row: MemberRow }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <div aria-hidden className="size-8 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          {row.kind === 'device' ? (
            <MonitorIcon size={24} className="shrink-0 text-ods-text-secondary" />
          ) : (
            <ProviderMarks providers={row.providers ?? []} />
          )}
          <TruncateText>{row.name ?? ''}</TruncateText>
        </div>
        <TruncateText variant="h6" tone="secondary">
          {row.detail ?? ''}
        </TruncateText>
      </div>
    </div>
  );
}

export function MemberCell({ row }: { row: MemberRow }) {
  return row.kind === 'group' || row.kind === 'device' ? <RecordCell row={row} /> : <UserCell row={row} />;
}

export function MemberTypeCell({ row }: { row: MemberRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText loading={loading}>{row.kind ? MEMBER_TYPE[row.kind] : ''}</TruncateText>
      {row.via && (
        <div data-loading-optional className="min-w-0">
          <TruncateText variant="h6" tone="secondary">
            {`via ${row.via}`}
          </TruncateText>
        </div>
      )}
    </div>
  );
}

/**
 * A user's customers, named by its rules. A subgroup has none of its own (Figma 733:99325); a device's customers are the
 * devices wave's (`OrgDevice.customers`, W3), so it shows the empty mark until then.
 */
export function MemberCustomerCell({ row }: { row: MemberRow }) {
  if (row.kind === 'group') return <TruncateText>Counted through its members</TruncateText>;
  if (row.kind === 'device') return <TruncateText>{EMPTY_VALUE}</TruncateText>;
  return <CustomerCell row={row} showTenant={false} />;
}
