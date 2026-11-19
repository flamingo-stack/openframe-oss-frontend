'use client';

import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { SoftwarePageShell } from './components/shared/software-page-shell';
import { SOFTWARE_SECTIONS } from './components/shared/software-sections';
import { useSoftwareManagementGate } from './components/shared/use-software-management-gate';
import { SoftwareListView } from './components/software-list/software-list-view';

export default function SoftwarePage() {
  const gate = useSoftwareManagementGate();

  return (
    <SoftwarePageShell section="all" title={SOFTWARE_SECTIONS.all.label} errorMessage="Couldn't load software.">
      {/* The list is the page's content: in the grid layout its table is the page's scroll area. */}
      <TableLayoutScope fill>
        <SoftwareListView
          title={SOFTWARE_SECTIONS.all.label}
          emptyTitle="No software yet"
          emptyDescription="Software installed across your fleet will be listed here once devices report their inventory."
          loading={gate === 'loading'}
        />
      </TableLayoutScope>
    </SoftwarePageShell>
  );
}
