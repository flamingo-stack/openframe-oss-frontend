'use client';

import { RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { PROVIDER_ORDER, providerPresentation } from '../../utils/tenant-presentation';

// The radio as it will stand, locked and unselected, over every provider this build knows. Which of
// them the deployment offers is the only thing that changes on arrival.
const OPTIONS = PROVIDER_ORDER.map(provider => {
  const { label, radioDescription } = providerPresentation(provider);
  return { value: provider, label, description: radioDescription };
});

/** `ProviderField` before its options are known — the real radio, disabled. */
export function ProviderFieldSkeleton() {
  return <RadioGroupBlock options={OPTIONS} variant="grouped" disabled aria-label="Provider" aria-busy />;
}
