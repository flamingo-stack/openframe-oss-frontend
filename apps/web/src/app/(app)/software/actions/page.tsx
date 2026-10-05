'use client';

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
      <SoftwareActionsView loading={gate === 'loading'} />
    </SoftwarePageShell>
  );
}
