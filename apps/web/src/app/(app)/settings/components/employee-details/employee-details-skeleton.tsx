'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { EmployeeDetailsSummarySkeleton } from './employee-details-summary-skeleton';
import { EMPLOYEE_DETAILS_TITLE } from './employee-details-title';

/**
 * `EmployeeDetailsContent` while the record loads — the title as a bar and the
 * card's values as bars. Back works already. That is all that waits: the work
 * time below is mounted beside this by the view.
 */
export function EmployeeDetailsSkeleton() {
  const handleBack = useSafeBack(routes.settings.employees);
  return (
    <>
      <TitleBlock title={EMPLOYEE_DETAILS_TITLE} loading backButton={{ label: 'Back', onClick: handleBack }} />
      <EmployeeDetailsSummarySkeleton />
    </>
  );
}
