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
import { type ReactNode, Suspense } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { customerSelect_query$key } from '@/__generated__/customerSelect_query.graphql';
import type { customerSelectPaginationQuery } from '@/__generated__/customerSelectPaginationQuery.graphql';
import type { customerSelectQuery as CustomerSelectQueryType } from '@/__generated__/customerSelectQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';
import { type CustomerOption, toCustomerOption } from './customer-option';
import { withBoundOrganization } from './tenant-form-helpers';

// The "Select Customer" field of the New / Edit forms: a core `Select` without a search box (Figma
// comment #107) over the customers not yet bound to a connection, paged as the menu scrolls.

const CUSTOMER_PAGE_SIZE = 20;

const customerSelectQuery = graphql`
  query customerSelectQuery($first: Int!, $after: String) {
    ...customerSelect_query @arguments(first: $first, after: $after)
  }
`;

const customerSelectFragment = graphql`
  fragment customerSelect_query on Query
  @refetchable(queryName: "customerSelectPaginationQuery")
  @argumentDefinitions(first: { type: "Int", defaultValue: 20 }, after: { type: "String" }) {
    directoryConnectionOrganizations(first: $first, after: $after)
      @connection(key: "customerSelect_directoryConnectionOrganizations") {
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

const NO_OPTIONS: readonly CustomerOption[] = [];

interface CustomerSelectProps {
  value: string;
  onChange: (organizationId: string) => void;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** The customer this connection is already bound to; the API lists only unbound ones. */
  includeOrganization?: CustomerOption | null;
  /** Edit: hold the list until the bound customer is known, or a fully bound workspace reads "No customers available". */
  enabled?: boolean;
}

interface CustomerSelectShellProps extends Omit<CustomerSelectProps, 'includeOrganization' | 'enabled'> {
  options: readonly CustomerOption[];
  placeholder: string;
  /** Rendered last inside the menu — the load-more sentinel. */
  footer?: ReactNode;
}

function CustomerOptionLabel({ organization }: { organization: CustomerOption }) {
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
    </span>
  );
}

function CustomerSelectShell({
  value,
  onChange,
  error,
  invalid,
  disabled,
  options,
  placeholder,
  footer,
}: CustomerSelectShellProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        label="Select Customer"
        labelVariant="large"
        invalid={invalid}
        error={error}
        aria-label="Select Customer"
      >
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

function CustomerSelectOptions({ includeOrganization, disabled, ...props }: Omit<CustomerSelectProps, 'enabled'>) {
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

  const loaded = data.directoryConnectionOrganizations.edges.map(edge => toCustomerOption(edge.node));
  const options = withBoundOrganization(loaded, includeOrganization);
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

export function CustomerSelect({ enabled = true, includeOrganization, ...props }: CustomerSelectProps) {
  const loading = <CustomerSelectShell {...props} options={NO_OPTIONS} placeholder="Loading customers…" disabled />;
  if (!enabled) return loading;

  return (
    <ContentErrorBoundary
      fallback={() => (
        <CustomerSelectShell
          {...props}
          options={NO_OPTIONS}
          placeholder="Couldn't load customers"
          error={props.error ?? 'Reload the page to try again.'}
          disabled
        />
      )}
    >
      <Suspense fallback={loading}>
        <CustomerSelectOptions {...props} includeOrganization={includeOrganization} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
