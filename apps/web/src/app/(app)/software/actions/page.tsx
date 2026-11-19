'use client';

import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { SoftwareActionsView } from '../components/action-list/software-actions-view';
import { SoftwarePageShell } from '../components/shared/software-page-shell';
import { SOFTWARE_SECTIONS } from '../components/shared/software-sections';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';

export default function SoftwareActionsPage() {
  const gate = useSoftwareManagementGate();

  return (
    <SoftwarePageShell
      section="actions"
      title={SOFTWARE_SECTIONS.actions.label}
      errorMessage="Couldn't load software actions."
    >
      {/* The list is the page's content: in the grid layout its table is the page's scroll area. */}
      <TableLayoutScope fill>
        <SoftwareActionsView loading={gate === 'loading'} />
      </TableLayoutScope>
    </SoftwarePageShell>
  );
}
