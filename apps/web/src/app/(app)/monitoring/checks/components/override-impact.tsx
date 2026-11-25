'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLazyLoadQuery } from 'react-relay';
import type { insightCheckOverrideImpactQuery as ImpactQueryType } from '@/__generated__/insightCheckOverrideImpactQuery.graphql';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { insightCheckOverrideImpactQuery } from '@/graphql/insights/insight-check-override-impact-query';
import { NEXT_RUN_NOTE } from '../hooks/use-check-mutations';
import type { OverrideScopeType } from '../utils/check-transform';

/** The customer, tag or device an override is for, with its name for the lines that say it. */
export interface PickedScope {
  type: OverrideScopeType;
  id: string;
  name: string | null;
}

/** How many devices the override covers, and a warning when other overrides take over on some of them. */
export function OverrideImpact(props: { check: string; scope: PickedScope }) {
  return (
    <LoadingSuspense label="Counting devices">
      <OverrideImpactScope {...props} />
    </LoadingSuspense>
  );
}

/** While the devices are counted, the line that will say how many. */
function OverrideImpactScope(props: { check: string; scope: PickedScope }) {
  if (useLoadingScope()) return <LoadingParagraph type="h6" lines={1} />;
  return <OverrideImpactLive {...props} />;
}

function OverrideImpactLive({ check, scope }: { check: string; scope: PickedScope }) {
  const { insightCheckOverrideImpact: impact } = useLazyLoadQuery<ImpactQueryType>(
    insightCheckOverrideImpactQuery,
    { check, scopeType: scope.type, scopeId: scope.id },
    { fetchPolicy: 'store-and-network' },
  );
  const warning = impactWarning(scope.type, impact.deviceCount, impact.affectedDeviceCount);
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <p className="text-ods-text-secondary text-h6">
        {appliesToLine(scope, impact.deviceCount)} {NEXT_RUN_NOTE}
      </p>
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

function devicesWord(count: number): string {
  return count === 1 ? '1 device' : `${count} devices`;
}

/** "Applies to 6 devices now and to every device that joins Northwind Logistics later." */
function appliesToLine(scope: PickedScope, deviceCount: number): string {
  if (scope.type === InsightCheckScopeType.DEVICE) return 'Applies to this device only.';
  const later =
    scope.type === InsightCheckScopeType.CUSTOMER
      ? `every device that joins ${scope.name ?? 'this customer'} later`
      : 'every device that gets the tag later';
  return `Applies to ${devicesWord(deviceCount)} now and to ${later}.`;
}

/** Why another override takes over on some of the devices, by the kind of override being added. */
const TAKEN_OVER_BECAUSE: Record<OverrideScopeType, (those: string) => string> = {
  CUSTOMER: those =>
    `Device and tag overrides win over customer overrides, so this override does not apply on ${those}.`,
  TAG: those =>
    `A device override wins over a tag override, and among several tag overrides the strictest value applies on ${those}.`,
  DEVICE: () => 'On this device this override replaces them.',
};

/** The warning over the devices another override takes over; nothing when there are none. */
function impactWarning(
  type: OverrideScopeType,
  deviceCount: number,
  affected: number,
): { title: string; description: string } | null {
  if (affected <= 0) return null;
  const title =
    type === InsightCheckScopeType.DEVICE
      ? 'This device has other overrides'
      : `${affected} of ${devicesWord(deviceCount)} ${affected === 1 ? 'has' : 'have'} other overrides`;
  return { title, description: TAKEN_OVER_BECAUSE[type](affected === 1 ? 'that device' : 'those devices') };
}
