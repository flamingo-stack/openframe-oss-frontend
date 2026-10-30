'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SquareAvatar,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { customerSelect_query$key } from '@/__generated__/customerSelect_query.graphql';
import type { customerSelectPaginationQuery } from '@/__generated__/customerSelectPaginationQuery.graphql';
import type { customerSelectQuery as CustomerSelectQueryType } from '@/__generated__/customerSelectQuery.graphql';
import { ContentErrorBoundary, useRetryKey, NO_ITEMS } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { type PickerCustomer, toCustomerOption } from './customer-option';
import { withBoundOrganization } from './tenant-form-helpers';

// A customer field of "Customers and attribution": a core `Select` without a search box (Figma
// comment #107) over the workspace's active customers, paged as the menu scrolls. A customer may
// serve several directories, so every active one is listed; the ones picked in the form's other
// rows are left out.

const CUSTOMER_PAGE_SIZE = 20;

const customerSelectQuery = graphql`
  query customerSelectQuery($first: Int!, $after: String) {
    ...customerSelect_query @arguments(first: $first, after: $after)
  }
`;

// `organizations` lists active customers unless its filter says otherwise.
const customerSelectFragment = graphql`
  fragment customerSelect_query on Query
  @refetchable(queryName: "customerSelectPaginationQuery")
  @argumentDefinitions(first: { type: "Int", defaultValue: 20 }, after: { type: "String" }) {
    organizations(first: $first, after: $after) @connection(key: "customerSelect_organizations") {
      edges {
        node {
          ...customerOption_organization
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface CustomerSelectProps {
  value: string;
  onChange: (organizationId: string) => void;
  /** Default "Select Customer"; a customer row of a shared directory says "Customer". */
  label?: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  /**
   * The stored customer: the field names it before its list has paged to it. An archived or deleted one, which the
   * list never offers, is named with its badge.
   */
  includeOrganization?: PickerCustomer | null;
  /** The customers picked in the form's other rows: a customer is bound once per directory. */
  exclude?: readonly string[];
  /** Edit: hold the list until the stored customer is known. */
  enabled?: boolean;
}

interface CustomerSelectShellProps extends Omit<CustomerSelectProps, 'includeOrganization' | 'enabled'> {
  options: readonly PickerCustomer[];
  placeholder: string;
  /** Rendered last inside the menu — the load-more sentinel. */
  footer?: ReactNode;
}

/** A customer's avatar, name and badge: a picker's option, and a row of the details card's customer list. */
export function CustomerOptionLabel({ organization }: { organization: PickerCustomer }) {
  return (
    <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <SquareAvatar
        src={getFullImageUrl(organization.image?.imageUrl, organization.image?.hash)}
        alt={organization.name}
        fallback={organization.name}
        size="sm"
        variant="square"
      />
      <TruncateText as="span" className="text-inherit">
        {organization.name}
      </TruncateText>
      {organization.badge && <Tag as="span" variant="warning" label={organization.badge} className="shrink-0" />}
    </span>
  );
}

function CustomerSelectShell({
  value,
  onChange,
  label = 'Select Customer',
  error,
  invalid,
  disabled,
  options,
  placeholder,
  footer,
}: CustomerSelectShellProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger label={label} labelVariant="large" invalid={invalid} error={error} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(organization => (
          <SelectItem
            key={organization.organizationId}
            value={organization.organizationId}
            // Lets a long customer name shrink into an ellipsis instead of overflowing the menu.
            className="[&>span:first-child]:min-w-0 [&>span:first-child]:flex-1"
          >
            <CustomerOptionLabel organization={organization} />
          </SelectItem>
        ))}
        {footer}
      </SelectContent>
    </Select>
  );
}

function CustomerSelectOptions({
  includeOrganization,
  exclude,
  disabled,
  ...props
}: Omit<CustomerSelectProps, 'enabled'>) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<CustomerSelectQueryType>(
    customerSelectQuery,
    { first: CUSTOMER_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    customerSelectPaginationQuery,
    customerSelect_query$key
  >(customerSelectFragment, queryData);

  const loaded = data.organizations.edges.map(edge => toCustomerOption(edge.node));
  const options = withBoundOrganization<PickerCustomer>(loaded, includeOrganization).filter(
    organization => !exclude?.includes(organization.organizationId),
  );
  // Nothing to pick is a disabled field with the reason as its placeholder: Radix forbids an empty-valued item.
  const empty = options.length === 0 && !hasNext;

  // A callback ref, not an effect: Radix mounts the menu's children only while it is open, in a portal.
  const sentinelRef = (node: HTMLDivElement | null) => {
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isLoadingNext) loadNext(CUSTOMER_PAGE_SIZE);
      },
      { rootMargin: '100px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  return (
    <CustomerSelectShell
      {...props}
      options={options}
      disabled={disabled || empty}
      placeholder={empty ? 'No customers available' : 'Select Customer'}
      footer={hasNext ? <div ref={sentinelRef} aria-hidden className="h-px w-full" /> : null}
    />
  );
}

/**
 * The customer field. Before its list is read (held by `enabled`, or in a loading scope: its own boundary's
 * fallback, or the page's), and when the list cannot be read, it is the real field, locked, offering only its
 * stored customer, and reads nothing.
 */
export function CustomerSelect({ enabled = true, ...props }: CustomerSelectProps) {
  if (!enabled) {
    return <CustomerSelectLocked {...props} />;
  }

  return (
    <ContentErrorBoundary
      fallback={() => (
        <CustomerSelectLocked
          {...props}
          placeholder="Couldn't load customers"
          error={props.error ?? 'Reload the page to try again.'}
        />
      )}
    >
      <CustomerSelectList {...props} />
    </ContentErrorBoundary>
  );
}

/** The field over its list, with its own boundary: in its scope the reader draws the locked field. */
function CustomerSelectList(props: Omit<CustomerSelectProps, 'enabled'>) {
  return (
    <LoadingSuspense label="Loading customers">
      <CustomerSelectBody {...props} />
    </LoadingSuspense>
  );
}

function CustomerSelectBody(props: Omit<CustomerSelectProps, 'enabled'>) {
  if (useLoadingScope()) {
    return <CustomerSelectLocked {...props} />;
  }
  return <CustomerSelectOptions {...props} />;
}

/**
 * The real field, locked: what it is before its list is read, or once reading it failed. Its stored customer is its
 * one option — a Select whose value matches no item draws neither the item nor the placeholder, only an empty box.
 */
function CustomerSelectLocked({
  includeOrganization,
  placeholder = 'Select Customer',
  ...shellProps
}: Omit<CustomerSelectProps, 'enabled'> & { placeholder?: string }) {
  return (
    <CustomerSelectShell
      {...shellProps}
      options={includeOrganization ? [includeOrganization] : NO_ITEMS}
      placeholder={placeholder}
      disabled
    />
  );
}
