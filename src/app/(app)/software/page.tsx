'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { softwarePageErrorFallback } from './components/software-page-error';
import { SoftwareTable } from './components/software-table';
import { SoftwareTabNavigation } from './components/software-tabs';

export default function SoftwarePage() {
  return (
    <div className="flex w-full flex-col">
      <SoftwareTabNavigation activeTab="all" />
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary fallback={softwarePageErrorFallback('All Software', "Couldn't load software.")}>
          <SoftwareTable
            title="All Software"
            emptyTitle="No software yet"
            emptyDescription="Software installed across your fleet will be listed here once devices report their inventory."
          />
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
