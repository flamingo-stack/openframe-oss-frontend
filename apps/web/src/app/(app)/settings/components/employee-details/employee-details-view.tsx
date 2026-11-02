'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { EmployeeWorkTime } from '../employee-work-time';
import { EmployeeDetailsContent } from './employee-details-content';
import { EMPLOYEE_DETAILS_TITLE } from './employee-details-title';

/**
 * Employee details page.
 *
 * Not `PageLayout`: it takes the title as a prop, so a page whose title is the
 * record would suspend as a whole. This draws its box and puts the `TitleBlock`
 * inside the content, so only what reads the user waits.
 *
 * The work time reads nothing off the record — it fetches by id — so it sits
 * BESIDE the record's island, not behind it, and its query runs alongside.
 */
export function EmployeeDetailsView({ userId }: { userId: string }) {
  return (
    <div className="flex w-full flex-col px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <ContentErrorBoundary title={EMPLOYEE_DETAILS_TITLE} message="Couldn't load the employee." resetKey={userId}>
        <EmployeeDetailsContent userId={userId} />
      </ContentErrorBoundary>
      <div className="flex flex-col pt-[var(--spacing-system-l)]">
        <EmployeeWorkTime userId={userId} />
      </div>
    </div>
  );
}
