'use client';

import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareEngineCell_software$key } from '@/__generated__/softwareEngineCell_software.graphql';
import { ValueText } from '@/app/components/shared';
import { SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

const softwareEngineCellFragment = graphql`
  fragment softwareEngineCell_software on Software {
    source
  }
`;

/** ENGINE column: the package manager that manages the title — the empty mark for one installed by hand. */
export function SoftwareEngineCell({ software }: { software: softwareEngineCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its bar.
  const data = useFragment(softwareEngineCellFragment, useLoadingScope() ? null : software);
  const source = data?.source;
  const label =
    source && source !== SoftwareSource.UNMANAGED ? (presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source) : null;
  return <ValueText value={data ? label : undefined} />;
}
