'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareVulnerabilitiesCell_software$key } from '@/__generated__/softwareVulnerabilitiesCell_software.graphql';
import { ValueText } from '@/app/components/shared';
import { pluralize } from '@/lib/pluralize';

const softwareVulnerabilitiesCellFragment = graphql`
  fragment softwareVulnerabilitiesCell_software on Software {
    cpeMatched
    vulnerabilitySummary {
      cveCount
    }
  }
`;

/**
 * VULNS column: how many CVEs are matched to the title — or, for one the
 * scanner found no CPE entry for, "no CPE match" under the empty mark. No
 * severity anywhere in the Software module: the scanner does not rate the
 * CVEs it reports, so a band would only ever read as empty.
 */
export function SoftwareVulnerabilitiesCell({ software }: { software: softwareVulnerabilitiesCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareVulnerabilitiesCellFragment, useLoadingScope() ? null : software);
  const cveCount = data?.vulnerabilitySummary?.cveCount ?? 0;

  return (
    <div className="flex min-w-0 flex-col justify-center">
      {cveCount > 0 ? <TruncateText>{pluralize(cveCount, 'CVE')}</TruncateText> : <ValueText value={null} />}
      {/* Only an explicit `false` means "scanned, no CPE entry"; a null is
          simply "not known", which must not print the note. */}
      {cveCount === 0 && data?.cpeMatched === false && (
        <TruncateText variant="h6" tone="secondary">
          no CPE match
        </TruncateText>
      )}
    </div>
  );
}
