'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SquareAvatar,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getFullImageUrl } from '@/lib/image-url';
import { useTenantOrganizations } from '../hooks/use-tenant-connections';
import type { TenantOrganization } from '../types/tenant-connection';

// The "Select Customer" field of the New / Edit forms (Figma 2097-122207 /
// 2097-123264). A core `Select` — the one picker without a text box, which is
// what "no search" means (Figma comment #107) — over the customers a connection
// may still be bound to. Phase 2 drops the customer ↔ connection binding from
// these forms; this file and the zod fragment in `tenant-form.types.ts` are the
// two things that go with it.

interface CustomerSelectProps {
  value: string;
  onChange: (organizationId: string) => void;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  /**
   * Edit only: the customer this connection is already bound to. The backend
   * list excludes bound customers, so without this the current value would have
   * no option to show.
   */
  includeOrganizationId?: string;
  /** Hold the request until the record it depends on is known (Edit), so the list is fetched once, with the right key. */
  enabled?: boolean;
}

function CustomerOption({ organization }: { organization: TenantOrganization }) {
  return (
    <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <SquareAvatar
        src={getFullImageUrl(organization.imageUrl)}
        alt={organization.name}
        fallback={organization.name}
        size="sm"
        variant="square"
      />
      <TruncateText as="span" className="text-inherit">
        {organization.name}
      </TruncateText>
    </span>
  );
}

export function CustomerSelect({
  value,
  onChange,
  error,
  invalid,
  disabled,
  includeOrganizationId,
  enabled = true,
}: CustomerSelectProps) {
  const query = useTenantOrganizations({ includeOrganizationId, enabled });
  const organizations = query.data ?? [];
  const loadFailed = query.isError;
  // Nothing to pick from is a disabled field with the reason as its placeholder,
  // not an empty menu: Radix forbids an empty-valued item, and "no customers" is
  // a state to read, not an option to choose.
  const empty = query.isSuccess && organizations.length === 0;
  const placeholder = query.isPending
    ? 'Loading customers…'
    : loadFailed
      ? "Couldn't load customers"
      : empty
        ? 'No customers available'
        : 'Select Customer';

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || query.isPending || loadFailed || empty}>
      <SelectTrigger
        label="Select Customer"
        labelVariant="large"
        invalid={invalid}
        error={error ?? (loadFailed ? 'Reload the page to try again.' : undefined)}
        aria-label="Select Customer"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {organizations.map(organization => (
          <SelectItem
            key={organization.id}
            value={organization.id}
            // The item text is an inline span beside the check mark; letting it
            // shrink is what turns a long customer name into an ellipsis rather
            // than an overflow past the menu's edge.
            className="[&>span:first-child]:min-w-0 [&>span:first-child]:flex-1"
          >
            <CustomerOption organization={organization} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
