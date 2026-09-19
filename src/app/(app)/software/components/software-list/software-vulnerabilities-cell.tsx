'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareVulnerabilitiesCell_software$key } from '@/__generated__/softwareVulnerabilitiesCell_software.graphql';
import { CveSeverityTag, ValueText } from '@/app/components/shared';
import { SoftwareCveSeverity } from '@/generated/schema-enums';
import { pluralize } from '@/lib/pluralize';

const softwareVulnerabilitiesCellFragment = graphql`
  fragment softwareVulnerabilitiesCell_software on Software {
    cpeMatched
    vulnerabilitySummary {
      highestSeverity
      cveCount
    }
  }
`;

/**
 * VULNS column: the worst severity and the CVE count — or, for a title the
 * scanner found no CPE entry for, "no CPE match" instead of a severity.
 */
export function SoftwareVulnerabilitiesCell({ software }: { software: softwareVulnerabilitiesCell_software$key }) {
  const { cpeMatched, vulnerabilitySummary } = useFragment(softwareVulnerabilitiesCellFragment, software);
  const highestSeverity = vulnerabilitySummary?.highestSeverity;
  const cveCount = vulnerabilitySummary?.cveCount ?? 0;
  const hasVulnerabilities = !!highestSeverity && highestSeverity !== SoftwareCveSeverity.NONE && cveCount > 0;

  return (
    <div className="flex min-w-0 flex-col justify-center">
      {hasVulnerabilities ? <CveSeverityTag severity={highestSeverity} /> : <ValueText value={null} />}
      {hasVulnerabilities ? (
        <TruncateText variant="h6" tone="secondary">
          {pluralize(cveCount, 'CVE')}
        </TruncateText>
      ) : (
        // Only an explicit `false` means "scanned, no CPE entry"; a null is
        // simply "not known", which must not print the note.
        cpeMatched === false && (
          <TruncateText variant="h6" tone="secondary">
            no CPE match
          </TruncateText>
        )
      )}
    </div>
  );
}
