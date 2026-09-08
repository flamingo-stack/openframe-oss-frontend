'use client';

import type { SoftwareFilterInput } from '@/__generated__/softwaresTableRelayQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { SoftwareCveSeverity } from '@/generated/schema-enums';
import { softwarePageErrorFallback } from '../components/software-page-error';
import { SoftwareTable } from '../components/software-table';
import { SoftwareTabNavigation } from '../components/software-tabs';

/**
 * The same inventory narrowed to titles with at least one known CVE — `minSeverity`
 * is the lowest band the backend filter accepts, so LOW means "has any". Fixed
 * scope, module-level for a stable identity (see the Updates page).
 */
const VULNERABLE_SCOPE: SoftwareFilterInput = { minSeverity: SoftwareCveSeverity.LOW };

export default function SoftwareVulnerabilitiesPage() {
  return (
    <div className="flex w-full flex-col">
      <SoftwareTabNavigation activeTab="vulnerabilities" />
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary fallback={softwarePageErrorFallback('Vulnerabilities', "Couldn't load vulnerabilities.")}>
          <SoftwareTable
            title="Vulnerabilities"
            scopeFilter={VULNERABLE_SCOPE}
            emptyTitle="No vulnerable software"
            emptyDescription="Software titles matched to a known CVE will be listed here, with the highest severity found."
          />
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
