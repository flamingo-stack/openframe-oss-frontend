'use client';

import { InfoSection, type InfoSectionRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton } from '@/app/components/shared';
import { providerPresentation } from '../../utils/tenant-presentation';
import { INTEGRATION_LABELS } from './tenant-integration-labels';

const bar = (width: string): InfoSectionRow['value'] => ({
  type: 'custom',
  content: <InlineSkeleton className={`h-6 ${width}`} />,
});

/**
 * `TenantIntegrationSection` while its live read loads: the caption and every label real, the values
 * as bars. The page already holds the record, so the directory id carries the provider's label.
 */
export function TenantIntegrationSectionSkeleton({ provider }: { provider: string }) {
  const rows: InfoSectionRow[] = [
    { id: 'primary-domain', label: INTEGRATION_LABELS.primaryDomain, value: bar('w-32') },
    { id: 'directory-id', label: providerPresentation(provider).directoryIdLabel, value: bar('w-64') },
    { id: 'granted-by', label: INTEGRATION_LABELS.grantedBy, value: bar('w-48') },
    { id: 'scopes', label: INTEGRATION_LABELS.scopes, value: bar('w-56') },
    { id: 'authorised-by', label: INTEGRATION_LABELS.authorisedBy, value: bar('w-72') },
    { id: 'domains', label: INTEGRATION_LABELS.domains, value: bar('w-40') },
  ];
  return <InfoSection title="Integration" rows={rows} />;
}
