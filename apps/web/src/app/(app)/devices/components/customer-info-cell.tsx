'use client';

import { EntityImage, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { InfoCell } from '@/app/components/shared/info-cell';
import { routes } from '@/lib/routes';

/** The customer's logo, loaded and loading. */
const CUSTOMER_LOGO_SIZE = 'size-10';

export interface CustomerInfoCellProps {
  /** The customer the record belongs to; null when it has none (the empty mark). */
  customer: { id?: string | null; name?: string | null; logoUrl?: string | null } | null;
}

/**
 * The "Customer ID (Site)" cell of the device card and of a recording's meta card: the customer's logo beside an
 * `InfoCell` whose value links to the customer. In its record's loading scope the logo and the cell draw their own
 * loading states; a record with no customer reads the empty mark, with no logo.
 */
export function CustomerInfoCell({ customer }: CustomerInfoCellProps) {
  const loading = useLoadingScope();
  const name = customer?.name;
  const href = customer?.id ? routes.customers.details(customer.id) : undefined;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      {(loading || name) && <EntityImage src={customer?.logoUrl} alt={name ?? ''} sizeClassName={CUSTOMER_LOGO_SIZE} />}
      <InfoCell
        label="Customer ID (Site)"
        skeletonWidth="w-28"
        value={
          name && href ? (
            <Link href={href} className="text-ods-accent underline hover:opacity-80">
              {name}
            </Link>
          ) : (
            name
          )
        }
      />
    </div>
  );
}
