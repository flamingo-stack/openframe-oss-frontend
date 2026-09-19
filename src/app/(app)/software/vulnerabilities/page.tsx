'use client';

import { SoftwarePageShell } from '../components/shared/software-page-shell';
import { SOFTWARE_SECTIONS } from '../components/shared/software-sections';
import { VulnerabilityListView } from '../components/vulnerability-list/vulnerability-list-view';

export default function SoftwareVulnerabilitiesPage() {
  return (
    <SoftwarePageShell
      section="vulnerabilities"
      title={SOFTWARE_SECTIONS.vulnerabilities.label}
      errorMessage="Couldn't load vulnerabilities."
    >
      <VulnerabilityListView />
    </SoftwarePageShell>
  );
}
