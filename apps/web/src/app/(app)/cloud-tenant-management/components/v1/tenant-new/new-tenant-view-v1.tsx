'use client';
'use no memo';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-new/new-tenant-view.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useState } from 'react';
import { useFormState } from 'react-hook-form';
import type { DirectoryProvider } from '@/generated/schema-enums';
import { GENERATE_LINK_LABEL, TenantFormFrame } from '../../shared/tenant-form-frame';
import { ProviderFieldV1 } from '../tenant-form/provider-field-v1';
import { TenantFormFieldsV1 } from '../tenant-form/tenant-form-fields-v1';
import { useNewTenantFormV1 } from './use-new-tenant-form-v1';

/**
 * `/cloud-tenant-management/new` before a record exists (Figma 2097-122192): the provider picker,
 * the three fields and "Generate Connection Link". Success moves to `?id=` — `ConnectTenantViewV1`. In a
 * loading scope (the module's flag window) the fields are locked and the picker and the customer list draw their
 * own loading states without fetching.
 */
export function NewTenantViewV1() {
  const loading = useLoadingScope();
  const { form, isCreating, generateLink } = useNewTenantFormV1();
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
      <TenantFormFieldsV1
        control={form.control}
        disabled={isCreating || loading}
        providerField={
          <ProviderFieldV1 control={form.control} disabled={isCreating || loading} onOffered={setOffered} />
        }
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
