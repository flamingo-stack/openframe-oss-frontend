'use client';

import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantRecordLoaderQuery as TenantRecordLoaderQueryType } from '@/__generated__/tenantRecordLoaderQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { TenantIdentityCard } from '../tenant-detail/tenant-summary-card';
import { type CustomerOption, toCustomerOption } from '../tenant-form/customer-option';
import { connectionToFormValues } from '../tenant-form/tenant-form-helpers';
import type { TenantFormData } from '../tenant-form/tenant-form.types';

const tenantRecordLoaderQuery = graphql`
  query tenantRecordLoaderQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      name
      provider
      domain
      organizationId
      organization {
        ...customerOption_organization
      }
      ...tenantSummaryCard_identity
    }
  }
`;

/** What the Edit page knows about the record it edits. */
export type TenantRecordState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; values: TenantFormData; organization: CustomerOption };

interface TenantRecordLoaderProps {
  id: string;
  onResolved: (state: TenantRecordState) => void;
}

/**
 * The Edit page's data island: it draws the identity card and hands the record up, where the owner
 * of `useForm` seeds the form (`useSeedForm` — the write cannot happen here).
 */
export function TenantRecordLoader({ id, onResolved }: TenantRecordLoaderProps) {
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<TenantRecordLoaderQueryType>(
    tenantRecordLoaderQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Identity matters: `useSeedForm` seeds once per values object, so it changes only with the record.
  const state = useMemo<TenantRecordState>(() => {
    if (!connection) return { status: 'missing' };
    const { name, provider, domain, organizationId, organization } = connection;
    return {
      status: 'ready',
      values: connectionToFormValues({ name, provider, domain, organizationId }),
      organization: toCustomerOption(organization),
    };
  }, [connection]);

  // Layout effect: the page seeds and unlocks the fields before the paint when the record is cached.
  useLayoutEffect(() => {
    onResolved(state);
  }, [state, onResolved]);

  return connection ? <TenantIdentityCard connection={connection} /> : null;
}
