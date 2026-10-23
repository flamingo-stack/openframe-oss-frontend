'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantRecordLoaderQuery as TenantRecordLoaderQueryType } from '@/__generated__/tenantRecordLoaderQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { TenantIdentityCard } from '../tenant-detail/tenant-summary-card';
import { readTenantFormRecord, type TenantFormRecord } from '../tenant-form/tenant-form-helpers';

const tenantRecordLoaderQuery = graphql`
  query tenantRecordLoaderQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      ...tenantFormHelpers_connection
      ...tenantSummaryCard_identity
    }
  }
`;

/** What the Edit page knows about the record it edits. */
export type TenantRecordState =
  { status: 'loading' } | { status: 'missing' } | ({ status: 'ready' } & TenantFormRecord);

interface TenantRecordLoaderProps {
  id: string;
  onResolved: (state: TenantRecordState) => void;
}

/**
 * The Edit page's data island: it draws the identity card and hands the record up, where the owner
 * of `useForm` seeds the form (`useSeedForm` — the write cannot happen here).
 */
export function TenantRecordLoader(props: TenantRecordLoaderProps) {
  // In a loading scope (the page's Suspense fallback, or the module's flag window): the card's own loading state,
  // and nothing read or handed up.
  if (useLoadingScope()) {
    return <TenantIdentityCard connection={null} />;
  }
  return <TenantRecordQuery {...props} />;
}

function TenantRecordQuery({ id, onResolved }: TenantRecordLoaderProps) {
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<TenantRecordLoaderQueryType>(
    tenantRecordLoaderQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Identity matters: `useSeedForm` seeds once per values object, so it changes only with the record.
  const state = useMemo<TenantRecordState>(() => {
    if (!connection) return { status: 'missing' };
    return { status: 'ready', ...readTenantFormRecord(connection) };
  }, [connection]);

  // Layout effect: the page seeds and unlocks the fields before the paint when the record is cached.
  useLayoutEffect(() => {
    onResolved(state);
  }, [state, onResolved]);

  return connection ? <TenantIdentityCard connection={connection} /> : null;
}
