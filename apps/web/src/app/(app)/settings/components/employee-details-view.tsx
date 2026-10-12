'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { EmployeeDetailsContent } from './employee-details-content';
import { CARD_CONTAINER, CARD_ROW } from './employee-details-layout';

interface EmployeeDetailsViewProps {
  userId: string;
}

function ProfileFieldSkeleton({ valueClassName }: { valueClassName: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Skeleton className={valueClassName} />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function EmployeeSummarySkeleton() {
  return (
    <div className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
          {/* Mirrors the loaded avatar: 36px on mobile, 48px on md+. */}
          <Skeleton className="size-9 shrink-0 rounded-full content-md:size-12" />
          <ProfileFieldSkeleton valueClassName="h-6 w-32" />
        </div>
        <ProfileFieldSkeleton valueClassName="h-6 w-40" />
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        <ProfileFieldSkeleton valueClassName="h-6 w-24" />
        <ProfileFieldSkeleton valueClassName="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

export function EmployeeDetailsView({ userId }: EmployeeDetailsViewProps) {
  const handleBack = useSafeBack(routes.settings.employees);

  return (
    <ContentErrorBoundary label="Employee" message="Couldn't load the employee." resetKey={userId}>
      <Suspense
        fallback={
          // The non-breaking space reserves the title's h1 height while loading
          // (PageLayout's title is string-only, so the bar can't be a Skeleton) — it
          // keeps the card from jumping. Spelled as a literal NBSP, not &nbsp;, because
          // the value is handed straight to a string-typed prop.
          <PageLayout
            title=" "
            backButton={{ label: 'Back', onClick: handleBack }}
            className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
          >
            <EmployeeSummarySkeleton />
          </PageLayout>
        }
      >
        <EmployeeDetailsContent userId={userId} onBack={handleBack} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
