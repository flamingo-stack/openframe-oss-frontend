'use client';
'use no memo';

import { Alert, RadioGroupBlock, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useEffect, useMemo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { providerFieldQuery as ProviderFieldQueryType } from '@/__generated__/providerFieldQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import type { DirectoryProvider } from '@/generated/schema-enums';
import { PROVIDER_ORDER, providerPresentation } from '../../utils/tenant-presentation';
import type { TenantFormData } from './tenant-form.types';

const providerFieldQuery = graphql`
  query providerFieldQuery {
    directoryConnectionOptions {
      providers
    }
  }
`;

interface ProviderFieldProps {
  control: Control<TenantFormData>;
  disabled?: boolean;
  /** The provider is fixed once a connection exists (a record has one). */
  locked?: boolean;
  /** The providers this deployment offers, in `PROVIDER_ORDER`; a value this build does not know is left out. */
  onOffered: (providers: readonly DirectoryProvider[]) => void;
}

function ProviderOptions({ control, disabled = false, locked = false, onOffered }: ProviderFieldProps) {
  const retryKey = useRetryKey();
  const { directoryConnectionOptions } = useLazyLoadQuery<ProviderFieldQueryType>(
    providerFieldQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { providers } = directoryConnectionOptions;
  // Memoised for identity: the effect below reports it up, and a fresh array each render would re-run it.
  const offered = useMemo(() => PROVIDER_ORDER.filter(provider => providers.includes(provider)), [providers]);

  useEffect(() => {
    onOffered(offered);
  }, [offered, onOffered]);

  if (offered.length === 0) {
    return (
      <Alert variant="warning" className="p-[var(--spacing-system-s)]" role="status">
        <p className="text-h4">No directory provider is enabled for this workspace yet.</p>
      </Alert>
    );
  }

  return (
    <Controller
      name="provider"
      control={control}
      render={({ field, fieldState }) => (
        <RadioGroupBlock
          name={field.name}
          value={field.value}
          onValueChange={field.onChange}
          options={offered.map(provider => {
            const { label, radioDescription } = providerPresentation(provider);
            return { value: provider, label, description: radioDescription };
          })}
          variant="grouped"
          disabled={disabled || locked}
          error={fieldState.error?.message}
          aria-label="Provider"
        />
      )}
    />
  );
}

/** The provider radio of the New form, over the providers this deployment has enabled. */
export function ProviderField(props: ProviderFieldProps) {
  return (
    <Suspense fallback={<Skeleton className="h-[136px] w-full rounded-md" />}>
      <ProviderOptions {...props} />
    </Suspense>
  );
}
