'use client';

import { LoadingSuspense, TextLinesByBreakpointSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  InfoSection,
  type InfoSectionRow,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
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

/** A break opportunity after every dot and at sign: a domain or an address wraps between its parts, not mid-word. */
function breakAtParts(text: string): ReactNode[] {
  return text.split(/(?<=[.@])/).flatMap((part, index) => (index === 0 ? [part] : [<wbr key={index} />, part]));
}

/**
 * A right-aligned value, one line per entry, that wraps where it does not fit: `InfoSection`'s text values truncate,
 * and the full text is then only a hover away, never on a phone. Ten-plus scopes must wrap too (Figma comment #109).
 */
function WrappingValue({ lines }: { lines: readonly string[] }) {
  return (
    <div className="flex flex-col items-end text-right text-ods-text-primary text-h4 [overflow-wrap:anywhere]">
      {lines.map(line => (
        <span key={line}>{breakAtParts(line)}</span>
      ))}
    </div>
  );
}

function wrapping(...lines: string[]): InfoSectionRow['value'] {
  return { type: 'custom', content: <WrappingValue lines={lines} /> };
}

interface TenantIntegrationSectionProps {
  id: string;
  /**
   * The page's record usually holds it, so the loading rows carry the provider's directory id label; `null` before
   * the page's own record answers (the neutral labels).
   */
  provider: string | null;
}

const NOT_READ: InfoSectionRow['value'] = { text: '' };

/**
 * The scopes a typical tenant holds while they are read: a Microsoft 365 tenant holds five ("Users, Groups, Licences,
 * Devices, OAuth apps"). They wrap where the WINDOW is narrow (two lines on a phone), never because a docked panel
 * narrows the content, so the lines follow the viewport step.
 */
const SCOPES_NOT_READ: InfoSectionRow['value'] = {
  type: 'custom',
  content: (
    <span className="flex w-full flex-col items-end text-h4">
      <span className="contents md:hidden">
        <TextLinesByBreakpointSkeleton as="span" type="inherit" lines={{ phone: 2, md: 2, lg: 2 }} />
      </span>
      <span className="hidden md:contents">
        <TextLinesByBreakpointSkeleton as="span" type="inherit" lines={{ phone: 1, md: 1, lg: 1 }} />
      </span>
    </span>
  ),
};

type IntegrationData = NonNullable<TenantIntegrationSectionQueryType['response']['directoryConnection']>;

/**
 * The section's rows, label for label. With no record yet (a loading scope) the labels are real and every value is
 * empty: `InfoSection` draws each as a bar in the scope.
 */
function integrationRows(data: IntegrationData | null, provider: string | null): InfoSectionRow[] {
  const { directoryIdLabel, authorisedBy } = providerPresentation(data?.provider ?? provider);
  const domainNames = data?.domains.map(domain => domain.name) ?? [];
  const primaryDomain = data?.domains.find(domain => domain.primary)?.name ?? data?.domain ?? EMPTY_VALUE;
  const scopes = data ? capabilityLabels(data.access.capabilities) : [];
  /** A value read from the record; empty until it answers. */
  const read = (value: () => InfoSectionRow['value']): InfoSectionRow['value'] => (data ? value() : NOT_READ);

  return [
    { id: 'primary-domain', label: INTEGRATION_LABELS.primaryDomain, value: read(() => wrapping(primaryDomain)) },
    { id: 'directory-id', label: directoryIdLabel, value: read(() => wrapping(data?.directoryId ?? EMPTY_VALUE)) },
    {
      id: 'granted-by',
      label: INTEGRATION_LABELS.grantedBy,
      value: read(() => wrapping(data?.grantedBy ?? EMPTY_VALUE)),
    },
    {
      id: 'scopes',
      label: INTEGRATION_LABELS.scopes,
      value: data ? wrapping(scopes.length > 0 ? scopes.join(', ') : EMPTY_VALUE) : SCOPES_NOT_READ,
    },
    { id: 'authorised-by', label: INTEGRATION_LABELS.authorisedBy, value: read(() => wrapping(authorisedBy)) },
    {
      id: 'domains',
      label: INTEGRATION_LABELS.domains,
      value: read(() => wrapping(...(domainNames.length > 0 ? domainNames : [primaryDomain]))),
    },
  ];
}

/**
 * The "INTEGRATION" section of a connected tenant (Figma 2097-140910), row for row, with its own boundary: in its
 * scope the reader draws its own loading form.
 */
export function TenantIntegrationSection(props: TenantIntegrationSectionProps) {
  return (
    <LoadingSuspense label="Loading integration">
      <TenantIntegrationSectionReader {...props} />
    </LoadingSuspense>
  );
}

/**
 * In a loading scope (its boundary's fallback, or the page's own loading state) it reads nothing: `InfoSection` draws
 * the real caption and labels with a bar for each value.
 */
function TenantIntegrationSectionReader(props: TenantIntegrationSectionProps) {
  if (useLoadingScope()) {
    return <InfoSection title="Integration" rows={integrationRows(null, props.provider)} />;
  }
  return <TenantIntegrationSectionQuery id={props.id} provider={props.provider} />;
}

function TenantIntegrationSectionQuery({ id, provider }: TenantIntegrationSectionProps) {
  const retryKey = useRetryKey();
  const { directoryConnection: data } = useLazyLoadQuery<TenantIntegrationSectionQueryType>(
    tenantIntegrationSectionQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  // The page above has already said "not found" for a missing record.
  if (!data) return null;
  return <InfoSection title="Integration" rows={integrationRows(data, provider)} />;
}
