'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Autocomplete,
  type AutocompleteOption,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useDeferredValue, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { managerFieldQuery as ManagerFieldQueryType } from '@/__generated__/managerFieldQuery.graphql';
import { ContentErrorBoundary, SectionLoadError, noop, useRetryKey } from '@/app/components/shared';

// The Manager picker. Figma draws text, but `managerId` is an account id: a live account of the same connection,
// visible to the customer the edit is made for (contract §11.5), which is exactly what this query lists.

/** The API's largest page is 100; a longer list is narrowed by typing. */
const OPTIONS_LIMIT = 50;

const managerFieldQuery = graphql`
  query managerFieldQuery($organizationId: ID!, $connectionId: ID!, $search: String, $first: Int) {
    directoryUsers(
      organizationId: $organizationId
      search: $search
      filter: { connectionIds: [$connectionId] }
      first: $first
    ) {
      edges {
        node {
          accounts {
            id
            displayName
            email
            connection {
              id
            }
          }
        }
      }
    }
  }
`;

const LABEL = 'Manager';
const PLACEHOLDER = 'Select Manager';

type ManagerOption = AutocompleteOption<string>;

interface ManagerFieldProps {
  /** The account being edited: it cannot be its own manager. */
  accountId: string | null;
  connectionId: string | null;
  customerId: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  /** The stored manager, named before the list has answered or when it is not on the first page. */
  selected: ManagerOption | null;
  error?: string;
  /** The field cannot be changed: no read is made. */
  locked?: boolean;
  /** A write is in flight: the field stays mounted, inert. */
  disabled?: boolean;
}

function LockedManager({ value, selected, error }: Pick<ManagerFieldProps, 'value' | 'selected' | 'error'>) {
  return (
    <Autocomplete
      label={LABEL}
      labelVariant="large"
      options={selected ? [selected] : []}
      value={value}
      onChange={noop}
      placeholder={PLACEHOLDER}
      error={error}
      invalid={!!error}
      disabled
    />
  );
}

function ManagerOptions({
  accountId,
  connectionId,
  customerId,
  value,
  onChange,
  selected,
  error,
  disabled,
}: ManagerFieldProps & { connectionId: string; customerId: string }) {
  const retryKey = useRetryKey();
  const [input, setInput] = useState('');
  const debounced = useDebounce(input.trim(), 300);
  // A new search re-suspends the query: deferred, the open list keeps the last answer until the next one lands.
  const search = useDeferredValue(debounced);
  const { directoryUsers } = useLazyLoadQuery<ManagerFieldQueryType>(
    managerFieldQuery,
    { organizationId: customerId, connectionId, search: search || null, first: OPTIONS_LIMIT },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  const options = directoryUsers.edges.flatMap<ManagerOption>(({ node }) => {
    const account = node.accounts.find(item => item.connection?.id === connectionId);
    if (!account || account.id === accountId) return [];
    return [{ value: account.id, label: account.displayName, description: account.email ?? undefined }];
  });

  return (
    <Autocomplete
      label={LABEL}
      labelVariant="large"
      options={options}
      selectedOptions={selected ? [selected] : undefined}
      value={value}
      onChange={onChange}
      onSearchChange={setInput}
      loading={input.trim() !== search}
      placeholder={PLACEHOLDER}
      noOptionsText="No users match"
      error={error}
      invalid={!!error}
      disabled={disabled}
    />
  );
}

/** In a loading scope (its boundary's fallback, or the page's) the field draws its own skeleton and reads nothing. */
function ManagerBody(props: ManagerFieldProps & { connectionId: string; customerId: string }) {
  if (useLoadingScope()) return <LockedManager {...props} />;
  return <ManagerOptions {...props} />;
}

function ManagerList(props: ManagerFieldProps & { connectionId: string; customerId: string }) {
  return (
    <LoadingSuspense label="Loading users">
      <ManagerBody {...props} />
    </LoadingSuspense>
  );
}

/**
 * Reads the list under its own boundary, so a failed read costs this field, not the form: the rest still saves, and
 * an unchanged manager is not sent.
 */
export function ManagerField({ connectionId, customerId, locked = false, ...props }: ManagerFieldProps) {
  if (locked || !connectionId || !customerId) return <LockedManager {...props} />;
  return (
    <ContentErrorBoundary
      fallback={retry => (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <LockedManager {...props} />
          <SectionLoadError message="Couldn't read the users of this directory." onRetry={retry} />
        </div>
      )}
    >
      <ManagerList {...props} connectionId={connectionId} customerId={customerId} />
    </ContentErrorBoundary>
  );
}
