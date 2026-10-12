'use client';

import { packageManagerLabel } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionEngineCell_action$key } from '@/__generated__/softwareActionEngineCell_action.graphql';

const softwareActionEngineCellFragment = graphql`
  fragment softwareActionEngineCell_action on SoftwareActionRun {
    engine
  }
`;

/** ENGINE column: the package manager that ran it. */
export function SoftwareActionEngineCell({ action }: { action: softwareActionEngineCell_action$key }) {
  const { engine } = useFragment(softwareActionEngineCellFragment, action);
  return <TruncateText>{packageManagerLabel(engine)}</TruncateText>;
}
