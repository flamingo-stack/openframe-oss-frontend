'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { incidentCheckLinkCellQuery as IncidentCheckLinkCellQueryType } from '@/__generated__/incidentCheckLinkCellQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { routes } from '@/lib/routes';

/** The name of the check that opened an incident. */
const incidentCheckLinkCellQuery = graphql`
  query incidentCheckLinkCellQuery($check: String!) {
    insightCheck(check: $check) {
      title
    }
  }
`;

/** The check's name, linking to its page; read on its own, so the card does not wait for it. */
export function IncidentCheckLinkCell({ check }: { check: string }) {
  return (
    <ContentErrorBoundary
      fallback={() => <InfoCell value={<CheckLink check={check}>Open check</CheckLink>} label="Check" />}
    >
      <CheckLinkIsland check={check} />
    </ContentErrorBoundary>
  );
}

function CheckLinkIsland({ check }: { check: string }) {
  return (
    <LoadingSuspense label="Loading check">
      <CheckLinkReader check={check} />
    </LoadingSuspense>
  );
}

function CheckLinkReader({ check }: { check: string }) {
  if (useLoadingScope()) return <InfoCell value="" label="Check" skeletonWidth="w-24" />;
  return <CheckLinkLive check={check} />;
}

function CheckLinkLive({ check }: { check: string }) {
  const data = useLazyLoadQuery<IncidentCheckLinkCellQueryType>(
    incidentCheckLinkCellQuery,
    { check },
    { fetchPolicy: 'store-or-network' },
  );
  return <InfoCell value={<CheckLink check={check}>{data.insightCheck.title}</CheckLink>} label="Check" />;
}

/** The check's page, as the design system draws a value that opens something: the link button in the primary text. */
function CheckLink({ check, children }: { check: string; children: string }) {
  return (
    <Button variant="link" size="compact" noPaddingX data-tone="primary" href={routes.monitoring.check(check)}>
      {children}
    </Button>
  );
}
