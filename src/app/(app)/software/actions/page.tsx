'use client';

import { SoftwareActionsView } from '../components/action-list/software-actions-view';
import { SoftwarePageShell } from '../components/shared/software-page-shell';
import { SOFTWARE_SECTIONS } from '../components/shared/software-sections';

export default function SoftwareActionsPage() {
  return (
    <SoftwarePageShell
      section="actions"
      title={SOFTWARE_SECTIONS.actions.label}
      errorMessage="Couldn't load software actions."
    >
      <SoftwareActionsView />
    </SoftwarePageShell>
  );
}
