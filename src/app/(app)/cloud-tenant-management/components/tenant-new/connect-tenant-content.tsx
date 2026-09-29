'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { connectTenantContentQuery as ConnectTenantContentQueryType } from '@/__generated__/connectTenantContentQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { readTenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { ConnectTenantForm } from './connect-tenant-form';

// Right after Generate this resolves from the store — the create mutation selected the same record
// and linked it under this lookup; a reload or bookmark fetches. No background refresh on top: a
// record created without a link mints one on mount, and a refetch landing after that mint would
// write the empty `consentUrl` back over it.
const connectTenantContentQuery = graphql`
  query connectTenantContentQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      ...tenantFormHelpers_connection
    }
  }
`;

/** The record the connect step edits — suspends on the query, so it lives under the view's `<Suspense>`. */
export function ConnectTenantContent({ id }: { id: string }) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<ConnectTenantContentQueryType>(
    connectTenantContentQuery,
    { id },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  if (!connection) {
    return (
      <PageLayout title="New Tenant Integration" backButton={{ label: 'Back to Integrations', onClick: handleBack }}>
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      </PageLayout>
    );
  }

  return <ConnectTenantForm record={readTenantFormRecord(connection)} />;
}
