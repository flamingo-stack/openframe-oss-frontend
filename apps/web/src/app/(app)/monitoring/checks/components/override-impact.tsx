'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { overrideImpactQuery as OverrideImpactQueryType } from '@/__generated__/overrideImpactQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { appliesToLine, impactWarning } from '../utils/check-messages';
import type { PickedScope } from '../utils/check-transform';

/** How many devices an exception at this scope would cover, and on how many another exception wins. */
const overrideImpactQuery = graphql`
  query overrideImpactQuery($check: String!, $scopeType: InsightCheckScopeType!, $scopeId: String!) {
    insightCheckOverrideImpact(check: $check, scopeType: $scopeType, scopeId: $scopeId) {
      deviceCount
      affectedDeviceCount
    }
  }
`;

interface OverrideImpactProps {
  check: string;
  scope: PickedScope;
}

/** How many devices the exception covers, and a warning when other exceptions take over on some of them. */
export function OverrideImpact(props: OverrideImpactProps) {
  return (
    <LoadingSuspense label="Counting devices">
      <OverrideImpactReader {...props} />
    </LoadingSuspense>
  );
}

/** While the devices are counted, the line that will say how many. */
function OverrideImpactReader(props: OverrideImpactProps) {
  if (useLoadingScope()) return <LoadingParagraph type="h6" lines={1} />;
  return <OverrideImpactLive {...props} />;
}

function OverrideImpactLive({ check, scope }: OverrideImpactProps) {
  // The enclosing boundary's Retry re-issues the count.
  const retryKey = useRetryKey();
  const { insightCheckOverrideImpact: impact } = useLazyLoadQuery<OverrideImpactQueryType>(
    overrideImpactQuery,
    { check, scopeType: scope.type, scopeId: scope.id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const warning = impactWarning(scope.type, impact.deviceCount, impact.affectedDeviceCount);
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <p className="text-ods-text-secondary text-h6">{appliesToLine(scope.type, impact.deviceCount)}</p>
      {warning && (
        <Alert>
          <InfoCircleIcon className="size-5 text-ods-text-secondary" />
          <AlertTitle>{warning.title}</AlertTitle>
          <AlertDescription>{warning.description}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
