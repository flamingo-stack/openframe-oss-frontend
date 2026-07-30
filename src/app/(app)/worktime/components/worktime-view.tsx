'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { WorkTimeTable } from '@/app/components/shared/work-time-table';

export function WorktimeView() {
  const [addWorkTimeOpen, setAddWorkTimeOpen] = useState(false);

  const actions = [
    {
      label: 'Add Work Time',
      // icons-v2, not the legacy `components/icons` one: that version hardcodes its
      // fill (`white` under `whiteOverlay`, brand green otherwise) and ignores every
      // text color, so it could not be muted. This one fills with `currentColor`.
      // Size is the button's to set (`[&_svg]:h-5`), so no `iconSize` either.
      icon: <PlusCircleIcon className="text-ods-text-secondary" />,
      onClick: () => setAddWorkTimeOpen(true),
      variant: 'outline' as const,
    },
  ];

  return (
    <PageLayout
      title="Worktime"
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <WorkTimeTable
        showEmployee
        showCustomer
        addWorkTimeOpen={addWorkTimeOpen}
        onAddWorkTimeOpenChange={setAddWorkTimeOpen}
      />
    </PageLayout>
  );
}
