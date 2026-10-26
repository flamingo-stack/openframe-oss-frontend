'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql } from 'react-relay';
import type { dataLossModuleRowsIncidentsQuery } from '@/__generated__/dataLossModuleRowsIncidentsQuery.graphql';
import type { dataLossModuleRowsIntegrationsQuery } from '@/__generated__/dataLossModuleRowsIntegrationsQuery.graphql';
import type { dataLossModuleRowsRecordingsQuery } from '@/__generated__/dataLossModuleRowsRecordingsQuery.graphql';
import type { dataLossModuleRowsRemoteSessionsQuery } from '@/__generated__/dataLossModuleRowsRemoteSessionsQuery.graphql';
import { useTenantManagementGate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { formatBytes } from '@/app/(app)/devices/components/remote-sessions/format';
import { useSessionRecordingsGate } from '@/app/(app)/devices/hooks/use-session-recordings-gate';
import { useIncidentsGate } from '@/app/(app)/incidents/hooks/use-incidents-gate';
import { ContentErrorBoundary, QueryIsland } from '@/app/components/shared';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { pluralNoun } from '@/lib/pluralize';
import { DataLossItem, DataLossStat } from './data-loss-item';

// One query per module, not fields on the dialog's shared query: where a module is
// off or not deployed, its field fails the whole document and would take the end
// date and every other count down with it.

const incidentsQuery = graphql`
  query dataLossModuleRowsIncidentsQuery {
    insightFilters {
      filteredCount
    }
  }
`;

const remoteSessionsQuery = graphql`
  query dataLossModuleRowsRemoteSessionsQuery {
    remoteSessions(first: 1) {
      totalCount
    }
  }
`;

const recordingsQuery = graphql`
  query dataLossModuleRowsRecordingsQuery {
    recordingStorage {
      usedBytes
    }
  }
`;

const integrationsQuery = graphql`
  query dataLossModuleRowsIntegrationsQuery {
    directoryConnections(first: 1) {
      totalCount
    }
  }
`;

/** Nothing when the module is off, zero or failed; a loading line until both the flag and the count answer. */
function ModuleRow({ gate, label, children }: { gate: FeatureFlagGate; label: string; children: ReactNode }) {
  if (gate === 'off') return null;
  // The row while the flag (a client read) or its count (a Suspense boundary) is on its way: the line itself, in a
  // loading scope.
  if (gate === 'loading') {
    return (
      <LoadingWhen loading>
        <DataLossItem />
      </LoadingWhen>
    );
  }
  return (
    <ContentErrorBoundary label={label} fallback={() => <></>}>
      <ModuleRowCount>{children}</ModuleRowCount>
    </ContentErrorBoundary>
  );
}

/** A module's count, with its own boundary: in its scope the reader draws its own loading form. */
function ModuleRowCount({ children }: { children: ReactNode }) {
  return (
    <LoadingSuspense label="Loading what the workspace loses">
      <ModuleRowCountReader>{children}</ModuleRowCountReader>
    </LoadingSuspense>
  );
}

function ModuleRowCountReader({ children }: { children: ReactNode }) {
  // In a loading scope (its boundary's fallback) it draws the line with no count and runs no read.
  if (useLoadingScope()) return <DataLossItem />;
  return <>{children}</>;
}

function CountRow({ value, children }: { value: number; children: ReactNode }) {
  if (value <= 0) return null;
  return (
    <DataLossItem>
      <DataLossStat value={value} />
      {children}
    </DataLossItem>
  );
}

/**
 * Rows of the flagged modules. Sessions and recordings share the Remote Sessions
 * page's gate but are two rows: `recordingStorage` can fail where sessions list fine.
 */
export function DataLossModuleRows() {
  const incidents = useIncidentsGate();
  const remoteSessions = useSessionRecordingsGate();
  const integrations = useTenantManagementGate();

  return (
    <>
      <ModuleRow gate={incidents} label="DataLossIncidents">
        <QueryIsland<dataLossModuleRowsIncidentsQuery>
          query={incidentsQuery}
          variables={{}}
          fetchPolicy="store-or-network"
        >
          {data => {
            const count = data.insightFilters.filteredCount ?? 0;
            return <CountRow value={count}>{` ${pluralNoun(count, 'incident')}`}</CountRow>;
          }}
        </QueryIsland>
      </ModuleRow>
      <ModuleRow gate={remoteSessions} label="DataLossRemoteSessions">
        <QueryIsland<dataLossModuleRowsRemoteSessionsQuery>
          query={remoteSessionsQuery}
          variables={{}}
          fetchPolicy="store-or-network"
        >
          {data => {
            const count = data.remoteSessions.totalCount;
            return <CountRow value={count}>{` remote ${pluralNoun(count, 'session')}`}</CountRow>;
          }}
        </QueryIsland>
      </ModuleRow>
      <ModuleRow gate={remoteSessions} label="DataLossRecordings">
        <QueryIsland<dataLossModuleRowsRecordingsQuery>
          query={recordingsQuery}
          variables={{}}
          fetchPolicy="store-or-network"
        >
          {data => {
            const { usedBytes } = data.recordingStorage;
            if (usedBytes <= 0) return null;
            return (
              <DataLossItem>
                <DataLossStat value={formatBytes(usedBytes)} />
                {` of remote session recordings`}
              </DataLossItem>
            );
          }}
        </QueryIsland>
      </ModuleRow>
      <ModuleRow gate={integrations} label="DataLossIntegrations">
        <QueryIsland<dataLossModuleRowsIntegrationsQuery>
          query={integrationsQuery}
          variables={{}}
          fetchPolicy="store-or-network"
        >
          {data => {
            const count = data.directoryConnections.totalCount;
            return <CountRow value={count}>{` connected cloud ${pluralNoun(count, 'tenant')}`}</CountRow>;
          }}
        </QueryIsland>
      </ModuleRow>
    </>
  );
}
