'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { WorkTimeTable } from '@/app/components/shared/work-time-table';
import { getFullImageUrl } from '@/lib/image-url';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { CustomerTabHeader } from './customer-tab-header';

interface CustomerWorktimeTabProps {
  /** `null` while the customer loads: the table draws itself in a loading scope until its global id is here. */
  organization: CustomerDetails | null;
}

/** Worktime logged for this customer — Employee + Time + Ticket & Notes (Customer column omitted). */
export function CustomerWorktimeTab({ organization }: CustomerWorktimeTabProps) {
  const [addOpen, setAddOpen] = useState(false);

  // "Add Work Time" here is scoped to this customer: prefill + lock the customer field.
  const addDefaultCustomer = useMemo(
    () =>
      organization
        ? {
            id: organization.organizationId,
            label: organization.name,
            imageUrl: getFullImageUrl(organization.imageUrl, organization.imageHash),
          }
        : undefined,
    [organization],
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <CustomerTabHeader
        title="Worktime"
        rightActions={
          <Button
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={!organization}
            leftIcon={<PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />}
          >
            Add Work Time
          </Button>
        }
      />
      {/* Scoped by the customer's global id: until it is here the table draws its loading state and reads nothing.
          Its params live under `wt` (`wtSearch`, `wtFrom`, `wtTo`, `wtEmployeeIds`, `wtCursor`, …): the Devices and
          Logs tabs on this page read the plain `search` and `organizationIds`, and a shared key would carry one tab's
          narrowing into another. */}
      <LoadingWhen loading={!organization}>
        <WorkTimeTable
          organizationGlobalId={organization?.id}
          paramPrefix="wt"
          showEmployee
          addWorkTimeOpen={addOpen}
          onAddWorkTimeOpenChange={setAddOpen}
          addDefaultCustomer={addDefaultCustomer}
        />
      </LoadingWhen>
    </div>
  );
}
