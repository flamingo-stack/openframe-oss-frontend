'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-new/connect-tenant-content.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { NotFoundError, PageLayout, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { connectTenantContentV1Query as ConnectTenantContentQueryType } from '@/__generated__/connectTenantContentV1Query.graphql';
import { useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { readTenantFormRecordV1 } from '../tenant-form/tenant-form-helpers-v1';
import { ConnectTenantFormV1 } from './connect-tenant-form-v1';

// Right after Generate this resolves from the store — the create mutation selected the same record
// and linked it under this lookup; a reload or bookmark fetches. No background refresh on top: a
// record created without a link mints one on mount, and a refetch landing after that mint would
// write the empty `consentUrl` back over it.
const connectTenantContentV1Query = graphql`
  query connectTenantContentV1Query($id: ID!) {
    directoryConnection(connectionId: $id) {
      ...tenantFormHelpersV1_connection
    }
  }
`;

/** The record the connect step edits, with its own boundary: in its scope the reader draws its own loading form. */
export function ConnectTenantContentV1({ id }: { id: string }) {
  return (
    <LoadingSuspense live label="Loading tenant form">
      <ConnectTenantContentReader id={id} />
    </LoadingSuspense>
  );
}

/**
 * In a loading scope (its boundary's fallback, or the module's flag window) it draws the form's own loading state;
 * otherwise it runs the query, which suspends.
 */
function ConnectTenantContentReader({ id }: { id: string }) {
  if (useLoadingScope()) {
    return <ConnectTenantFormV1 record={null} />;
  }
  return <ConnectTenantContentQuery id={id} />;
}

function ConnectTenantContentQuery({ id }: { id: string }) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  const retryKey = useRetryKey();
  const { directoryConnection: connection } = useLazyLoadQuery<ConnectTenantContentQueryType>(
    connectTenantContentV1Query,
    { id },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  if (!connection) {
    return (
      <PageLayout title="New Tenant Integration" backButton={{ label: 'Back', onClick: handleBack }}>
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      </PageLayout>
    );
  }

  return <ConnectTenantFormV1 record={readTenantFormRecordV1(connection)} />;
}
