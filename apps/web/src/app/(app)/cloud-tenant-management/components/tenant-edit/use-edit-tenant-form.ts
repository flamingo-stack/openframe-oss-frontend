'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { routes } from '@/lib/routes';
import { attributionChanged } from '../tenant-form/attribution-helpers';
import { ATTRIBUTION_DEFAULT_VALUES } from '../tenant-form/attribution.types';
import { changedFields, type TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import {
  editTenantFormSchema,
  TENANT_FORM_DEFAULT_VALUES,
  type TenantFormData,
} from '../tenant-form/tenant-form.types';
import { useAttributionForm } from '../tenant-form/use-attribution-form';
import { integrationInput, useSaveIntegration, useSubmitWithAttribution } from '../tenant-form/use-save-integration';

/**
 * The Edit page's forms (Figma 3126-14295): the name and the customers, real from the first paint, seeded from
 * `stored` by their `useForm` owner. Provider and domain ride along hidden and unvalidated; only a changed name,
 * and the customers when they changed, are sent.
 */
export function useEditTenantForm(id: string, stored: TenantFormRecord | null) {
  const { toast } = useToast();
  const router = useRouter();
  const { save, isSaving } = useSaveIntegration(id);
  const submit = useSubmitWithAttribution();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(editTenantFormSchema),
    defaultValues: TENANT_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });
  useSeedForm(form, stored?.values ?? null);
  const attribution = useAttributionForm(ATTRIBUTION_DEFAULT_VALUES, stored?.attribution.values ?? null);

  const handleSave = () => {
    if (!stored) return;
    // Untouched customers are neither checked nor sent: a rename does not wait on a customer nobody picked.
    const changedAttribution = attributionChanged(attribution.form.getValues(), stored.attribution.values)
      ? attribution.form
      : null;
    submit(form, changedAttribution, 'Cannot save yet', (values, attributionValues) => {
      save(
        integrationInput(changedFields(values, stored.values, ['name']), attributionValues, stored.attribution.values),
        {
          placeUserErrors: attribution.placeUserErrors,
          onSaved: () => {
            toast({ title: 'Integration saved', description: `${values.name} was updated.`, variant: 'success' });
            safeBackOrReplace(router, routes.cloudTenantManagement.details(id));
          },
        },
      );
    });
  };

  return { form, attributionForm: attribution.form, isSubmitting: isSaving, handleSave };
}
