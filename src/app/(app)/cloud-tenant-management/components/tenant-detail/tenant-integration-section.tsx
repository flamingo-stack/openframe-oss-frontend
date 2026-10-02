'use client';

import { InfoSection, type InfoSectionRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { tenantIntegrationSectionQuery as TenantIntegrationSectionQueryType } from '@/__generated__/tenantIntegrationSectionQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { capabilityLabels, providerPresentation } from '../../utils/tenant-presentation';
import { INTEGRATION_LABELS } from './tenant-integration-labels';

// Its own query, not a fragment of the page's: `domains` is a live provider read — the slowest field
// on the page — and only a connected tenant shows it. The page's record lands and paints first; this
// island then waits under its own skeleton, whose shape is known by the time it mounts.
const tenantIntegrationSectionQuery = graphql`
  query tenantIntegrationSectionQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      provider
      domain
      directoryId
      grantedBy
      domains {
        name
        primary
      }
      access {
        capabilities
      }
    }
  }
`;

/** A right-aligned value that may take several lines — `InfoSection`'s text values truncate. */
function MultiLineValue({ lines }: { lines: readonly string[] }) {
  return (
    <div className="flex flex-col items-end text-right text-ods-text-primary text-h4">
      {lines.map(line => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** The "INTEGRATION" section of a connected tenant (Figma 2097-140910), row for row. Suspends: mount it under `<Suspense>`. */
export function TenantIntegrationSection({ id }: { id: string }) {
  const retryKey = useRetryKey();
  const { directoryConnection: data } = useLazyLoadQuery<TenantIntegrationSectionQueryType>(
    tenantIntegrationSectionQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // The page above has already said "not found" for a missing record.
  if (!data) return null;
  const { directoryIdLabel, authorisedBy } = providerPresentation(data.provider);
  const domainNames = data.domains.map(domain => domain.name);
  const primaryDomain = data.domains.find(domain => domain.primary)?.name ?? data.domain ?? EMPTY_VALUE;
  const scopes = capabilityLabels(data.access.capabilities);

  const rows: InfoSectionRow[] = [
    { id: 'primary-domain', label: INTEGRATION_LABELS.primaryDomain, value: { text: primaryDomain } },
    { id: 'directory-id', label: directoryIdLabel, value: { text: data.directoryId ?? EMPTY_VALUE } },
    { id: 'granted-by', label: INTEGRATION_LABELS.grantedBy, value: { text: data.grantedBy ?? EMPTY_VALUE } },
    {
      id: 'scopes',
      label: INTEGRATION_LABELS.scopes,
      // Ten-plus scopes must wrap (Figma comment #109), so this is not a text value.
      value: {
        type: 'custom',
        content: (
          <span className="text-right text-ods-text-primary text-h4 [overflow-wrap:anywhere]">
            {scopes.length > 0 ? scopes.join(', ') : EMPTY_VALUE}
          </span>
        ),
      },
    },
    { id: 'authorised-by', label: INTEGRATION_LABELS.authorisedBy, value: { text: authorisedBy } },
    {
      id: 'domains',
      label: INTEGRATION_LABELS.domains,
      value:
        domainNames.length > 1
          ? { type: 'custom', content: <MultiLineValue lines={domainNames} /> }
          : { text: domainNames[0] ?? primaryDomain },
    },
  ];

  return <InfoSection title="Integration" rows={rows} />;
}
