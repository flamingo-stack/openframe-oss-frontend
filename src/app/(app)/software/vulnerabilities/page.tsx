'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { softwarePageErrorFallback } from '../components/software-page-error';
import { SoftwareTabNavigation } from '../components/software-tabs';
import { VulnerabilitiesTable } from '../components/vulnerabilities-table';

export default function SoftwareVulnerabilitiesPage() {
  return (
    <div className="flex w-full flex-col">
      <SoftwareTabNavigation activeTab="vulnerabilities" />
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary fallback={softwarePageErrorFallback('Vulnerabilities', "Couldn't load vulnerabilities.")}>
          <VulnerabilitiesTable />
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
