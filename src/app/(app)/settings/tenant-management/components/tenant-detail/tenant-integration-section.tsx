'use client';

import { InfoSection, type InfoSectionRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantIntegrationSection_connection$key } from '@/__generated__/tenantIntegrationSection_connection.graphql';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { capabilityLabels, providerPresentation } from '../../utils/tenant-presentation';

// `domains` and `access` are live provider reads: selected here only, where a connected tenant shows them.
const tenantIntegrationSectionFragment = graphql`
  fragment tenantIntegrationSection_connection on DirectoryConnection {
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

/** The "INTEGRATION" section of a connected tenant (Figma 2097-140910), row for row. */
export function TenantIntegrationSection({ connection }: { connection: tenantIntegrationSection_connection$key }) {
  const data = useFragment(tenantIntegrationSectionFragment, connection);
  const { directoryIdLabel, authorisedBy } = providerPresentation(data.provider);
  const domainNames = data.domains.map(domain => domain.name);
  const primaryDomain = data.domains.find(domain => domain.primary)?.name ?? data.domain ?? EMPTY_VALUE;
  const scopes = capabilityLabels(data.access.capabilities);

  const rows: InfoSectionRow[] = [
    { id: 'primary-domain', label: 'Primary domain', value: { text: primaryDomain } },
    {
      id: 'domains',
      label: 'Domains',
      value:
        domainNames.length > 1
          ? { type: 'custom', content: <MultiLineValue lines={domainNames} /> }
          : { text: domainNames[0] ?? primaryDomain },
    },
    { id: 'directory-id', label: directoryIdLabel, value: { text: data.directoryId ?? EMPTY_VALUE } },
    { id: 'granted-by', label: 'Granted by', value: { text: data.grantedBy ?? EMPTY_VALUE } },
    {
      id: 'scopes',
      label: 'Scopes held',
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
    { id: 'authorised-by', label: 'Authorised by', value: { text: authorisedBy } },
  ];

  return <InfoSection title="Integration" rows={rows} />;
}
