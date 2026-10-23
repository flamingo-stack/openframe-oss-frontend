'use client';
'use no memo';

import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useState } from 'react';
import { useFormState } from 'react-hook-form';
import type { DirectoryProvider } from '@/generated/schema-enums';
import { GENERATE_LINK_LABEL, TenantFormFrame } from '../shared/tenant-form-frame';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import { useNewTenantForm } from './use-new-tenant-form';

/**
 * `/cloud-tenant-management/new` before a record exists (Figma 2097-122192): the provider picker,
 * the domain and name fields and "Generate Connection Link". Success moves to `?id=` — `ConnectTenantView`. In a
 * loading scope (the module's flag window) the fields are locked and the picker draws its own loading state without
 * fetching.
 */
export function NewTenantView() {
  const loading = useLoadingScope();
  const { form, isCreating, generateLink } = useNewTenantForm();
  // The frames draw Generate disabled until the form is complete; `mode: 'onChange'` keeps this live.
  const { isValid } = useFormState({ control: form.control });
  // The providers this deployment offers; unknown until the picker's query answers.
  const [offered, setOffered] = useState<readonly DirectoryProvider[] | null>(null);
  const { getValues, setValue } = form;

  // A deployment may offer one provider only; the preselected Microsoft must follow what it offers.
  useEffect(() => {
    if (!offered || offered.includes(getValues('provider'))) return;
    const first = offered[0];
    if (first) setValue('provider', first, { shouldValidate: true });
  }, [offered, getValues, setValue]);

  return (
    <TenantFormFrame title="New Tenant Integration">
      <TenantFormFields
        control={form.control}
        disabled={isCreating || loading}
        providerField={<ProviderField control={form.control} disabled={isCreating || loading} onOffered={setOffered} />}
      />
      <div>
        <Button
          variant="accent"
          onClick={generateLink}
          // No provider on offer (or not known yet) leaves nothing a Generate could create.
          disabled={!isValid || !offered || offered.length === 0}
          loading={isCreating}
          className="w-full content-md:w-auto"
        >
          {GENERATE_LINK_LABEL}
        </Button>
      </div>
    </TenantFormFrame>
  );
}
