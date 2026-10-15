import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';

export function NewDeviceSkeleton() {
  return (
    <LoadingRegion className="contents" label="Loading device setup">
      <PageLayout className="p-[var(--spacing-system-l)]">
        <div className="flex flex-col gap-6">
          <UnifiedSkeleton className="h-5 w-40" />

          <div className="flex flex-col gap-3 content-md:flex-row content-md:items-center content-md:justify-between">
            <UnifiedSkeleton className="h-9 w-32" />
          </div>
          {/* Organization + Platform */}
          <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2">
            <UnifiedSkeleton className="h-12 w-full rounded-[6px]" />
            <UnifiedSkeleton className="h-12 w-full rounded-[6px]" />
          </div>

          {/* Add Device Tag */}
          <div className="flex items-center gap-2 py-3">
            <UnifiedSkeleton className="size-6 rounded-full" />
            <UnifiedSkeleton className="h-6 w-32" />
          </div>

          {/* Command box */}
          <div className="flex flex-col gap-4 rounded-[6px] border border-ods-border bg-ods-card p-6">
            <UnifiedSkeleton className="h-6 w-44" />
            <UnifiedSkeleton className="h-20 w-full rounded-[6px]" />
            <div className="flex justify-end gap-3">
              <UnifiedSkeleton className="h-12 w-52 rounded-[6px]" />
              <UnifiedSkeleton className="h-12 w-40 rounded-[6px]" />
            </div>
          </div>

          {/* Antivirus warning */}
          <div className="flex flex-col gap-4 rounded-[6px] border border-ods-border bg-ods-card p-6">
            <UnifiedSkeleton className="h-14 w-full rounded-[6px]" />
            <UnifiedSkeleton className="h-5 w-80" />
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <UnifiedSkeleton key={i} className="h-12 w-full rounded-[6px]" />
              ))}
            </div>
            <UnifiedSkeleton className="h-5 w-full max-w-xl" />
          </div>
        </div>
      </PageLayout>
    </LoadingRegion>
  );
}
