'use client';

import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, AlertDescription, AlertTitle } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatThreshold } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import { DetailsItem } from './details-item';
import { DetailsPanel } from './details-panel';

/** The default each device is measured against, one item per threshold; an on/off check says it has none. */
export function DefaultThreshold({ check }: { check?: Check }) {
  if (check && check.parameters.length === 0) {
    return (
      <Alert>
        <InfoCircleIcon className="size-5 text-ods-text-secondary" />
        <AlertTitle>No threshold</AlertTitle>
        <AlertDescription>
          This check is either on or off. Turn it off for a customer, a device tag or one device with an exception.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <DetailsPanel columns={check && check.parameters.length > 1 ? 'three' : 'one'}>
      {check ? (
        <>
          {check.parameters.map(parameter => (
            <DetailsItem
              key={parameter.parameter}
              label={parameter.label}
              value={formatThreshold(parameter.value, parameter.unit, parameter.firesWhen)}
            />
          ))}
          {/* The API raises the incident when any one of the values is crossed. */}
          {check.parameters.length > 1 && (
            <DetailsItem
              label="Raises an incident when"
              value={check.parameters.length === 2 ? 'Either is true' : 'Any is true'}
            />
          )}
        </>
      ) : (
        <DetailsItem label="Threshold" value="" skeletonWidth="w-32" />
      )}
    </DetailsPanel>
  );
}
