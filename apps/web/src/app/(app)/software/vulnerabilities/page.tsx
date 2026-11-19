'use client';

import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { SoftwarePageShell } from '../components/shared/software-page-shell';
import { SOFTWARE_SECTIONS } from '../components/shared/software-sections';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';
import { VulnerabilityListView } from '../components/vulnerability-list/vulnerability-list-view';

export default function SoftwareVulnerabilitiesPage() {
  const gate = useSoftwareManagementGate();

  return (
    <SoftwarePageShell
      section="vulnerabilities"
      title={SOFTWARE_SECTIONS.vulnerabilities.label}
      errorMessage="Couldn't load vulnerabilities."
    >
      {/* The list is the page's content: in the grid layout its table is the page's scroll area. */}
      <TableLayoutScope fill>
        <VulnerabilityListView loading={gate === 'loading'} />
      </TableLayoutScope>
    </SoftwarePageShell>
  );
}
