'use client';
'use no memo';

import { Button, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useState } from 'react';
import { useFormState } from 'react-hook-form';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import type { DirectoryProvider } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import { useNewTenantForm } from './use-new-tenant-form';

// The frames keep Save in the title bar throughout; it acts only from the connect step on.
const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };

/**
 * `/cloud-tenant-management/new` before a record exists (Figma 2097-122192): the provider picker,
 * the three fields and "Generate Connection Link". Success moves to `?id=` — `ConnectTenantView`.
 */
export function NewTenantView() {
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
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
    <PageLayout
      title="New Tenant Integration"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={[SAVE_PLACEHOLDER]}
      actionsVariant="primary-buttons"
    >
      <TenantFormFields
        control={form.control}
        disabled={isCreating}
        providerField={<ProviderField control={form.control} disabled={isCreating} onOffered={setOffered} />}
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
          Generate Connection Link
        </Button>
      </div>
    </PageLayout>
  );
}
