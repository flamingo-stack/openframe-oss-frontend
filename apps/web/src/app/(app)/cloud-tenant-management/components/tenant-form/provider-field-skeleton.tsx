'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { PROVIDER_ORDER, providerPresentation } from '../../utils/tenant-presentation';

// The radio as it will stand, locked and unselected, over every provider this build knows. Which of
// them the deployment offers is the only thing that changes on arrival.
const OPTIONS = PROVIDER_ORDER.map(provider => {
  const { label, radioDescription } = providerPresentation(provider);
  return { value: provider, label, description: radioDescription };
});

/**
 * `ProviderField` before its options are known: the real radio, disabled. `region={false}` inside another
 * loading region, which announces for the field.
 */
export function ProviderFieldSkeleton({ region = true }: { region?: boolean } = {}) {
  return (
    <LoadingRegion label="Loading providers" announce={region} className="contents">
      <RadioGroupBlock options={OPTIONS} variant="grouped" disabled aria-label="Provider" />
    </LoadingRegion>
  );
}
