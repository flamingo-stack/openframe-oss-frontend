'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwareDetailView } from '../components/software-detail-view';
import { softwarePageErrorFallback } from '../components/software-page-error';

export default function SoftwareDetailsPage() {
  // A missing id is a truncated link, not a page: bounce to the list rather than
  // querying `software(id: "")` and reporting it as "not found".
  const softwareId = useRequiredIdParam(routes.software.list);

  if (!softwareId) return null;

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary fallback={softwarePageErrorFallback('Software', "Couldn't load this software.")}>
          <SoftwareDetailView softwareId={softwareId} />
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
