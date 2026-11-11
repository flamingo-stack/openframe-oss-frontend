'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-edit/tenant-record-loader.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantRecordLoaderV1Query as TenantRecordLoaderQueryType } from '@/__generated__/tenantRecordLoaderV1Query.graphql';
import { useRetryKey } from '@/app/components/shared';
import type { CustomerOption } from '@/graphql/directory/customer-option';
import { TenantIdentityCardV1 } from '../tenant-detail/tenant-summary-card-v1';
import { readTenantFormRecordV1 } from '../tenant-form/tenant-form-helpers-v1';
import type { TenantFormDataV1 } from '../tenant-form/tenant-form-v1.types';

const tenantRecordLoaderV1Query = graphql`
  query tenantRecordLoaderV1Query($id: ID!) {
    directoryConnection(connectionId: $id) {
      ...tenantFormHelpersV1_connection
      ...tenantSummaryCardV1_identity
    }
  }
`;

/** What the Edit page knows about the record it edits. */
export type TenantRecordStateV1 =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; values: TenantFormDataV1; organization: CustomerOption | null };

interface TenantRecordLoaderProps {
  id: string;
  onResolved: (state: TenantRecordStateV1) => void;
}

/**
 * The Edit page's data island, with its own boundary: it draws the identity card and hands the record up, where the
 * owner of `useForm` seeds the form (`useSeedForm` — the write cannot happen here).
 */
export function TenantRecordLoaderV1(props: TenantRecordLoaderProps) {
  return (
    <LoadingSuspense label="Loading tenant">
      <TenantRecordLoaderReader {...props} />
    </LoadingSuspense>
  );
}

function TenantRecordLoaderReader(props: TenantRecordLoaderProps) {
  // In a loading scope (its boundary's fallback, or the module's flag window): the card's own loading state, and
  // nothing read or handed up.
  if (useLoadingScope()) {
    return <TenantIdentityCardV1 connection={null} />;
  }
  return <TenantRecordQuery {...props} />;
}

function TenantRecordQuery({ id, onResolved }: TenantRecordLoaderProps) {
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<TenantRecordLoaderQueryType>(
    tenantRecordLoaderV1Query,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Identity matters: `useSeedForm` seeds once per values object, so it changes only with the record.
  const state = useMemo<TenantRecordStateV1>(() => {
    if (!connection) return { status: 'missing' };
    const { values, organization } = readTenantFormRecordV1(connection);
    return { status: 'ready', values, organization };
  }, [connection]);

  // Layout effect: the page seeds and unlocks the fields before the paint when the record is cached.
  useLayoutEffect(() => {
    onResolved(state);
  }, [state, onResolved]);

  return connection ? <TenantIdentityCardV1 connection={connection} /> : null;
}
