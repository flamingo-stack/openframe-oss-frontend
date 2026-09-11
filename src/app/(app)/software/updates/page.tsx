'use client';

import type { SoftwareFilterInput } from '@/__generated__/softwaresTableRelayQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { SoftwareVersionStatus } from '@/generated/schema-enums';
import { softwarePageErrorFallback } from '../components/software-page-error';
import { SoftwareTable } from '../components/software-table';
import { SoftwareTabNavigation } from '../components/software-tabs';

/**
 * The same inventory narrowed to titles the fleet is behind on. A fixed scope,
 * not a user filter — module-level so its identity is stable across renders
 * (`useDeferredQuery` compares query variables by identity).
 */
const OUTDATED_SCOPE: SoftwareFilterInput = { versionStatuses: [SoftwareVersionStatus.OUTDATED] };

export default function SoftwareUpdatesPage() {
  return (
    <div className="flex w-full flex-col">
      <SoftwareTabNavigation activeTab="updates" />
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary
          fallback={softwarePageErrorFallback('Software Update', "Couldn't load software updates.")}
        >
          <SoftwareTable
            title="Software Update"
            scopeFilter={OUTDATED_SCOPE}
            emptyTitle="Everything is up to date"
            emptyDescription="Software titles with a newer version available across your fleet will be listed here."
          />
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
