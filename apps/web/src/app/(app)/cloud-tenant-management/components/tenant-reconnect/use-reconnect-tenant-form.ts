'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { attributionChanged } from '../tenant-form/attribution-helpers';
import { ATTRIBUTION_DEFAULT_VALUES } from '../tenant-form/attribution.types';
import type { TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { useAttributionForm } from '../tenant-form/use-attribution-form';
import { integrationInput, useSaveIntegration, useSubmitWithAttribution } from '../tenant-form/use-save-integration';

/**
 * Reconnect's Save (Figma 3287-10542): the customers, once the directory has answered readable and they changed;
 * then back to the details page, which the probe has already updated.
 */
export function useReconnectTenantForm(id: string, record: TenantFormRecord | null, readable: boolean) {
  const { toast } = useToast();
  const router = useRouter();
  const { save, isSaving } = useSaveIntegration(id);
  const submit = useSubmitWithAttribution();
  const attribution = useAttributionForm(record?.attribution.values ?? ATTRIBUTION_DEFAULT_VALUES);

  const back = () => safeBackOrReplace(router, routes.cloudTenantManagement.details(id));

  const handleSave = () => {
    // Locked or untouched customers have nothing to write: the page's own work was the consent.
    if (!record || !readable || !attributionChanged(attribution.form.getValues(), record.attribution.values)) {
      back();
      return;
    }
    submit(attribution.form, null, 'Cannot save yet', values => {
      save(integrationInput({}, values, record.attribution.values), {
        placeUserErrors: attribution.placeUserErrors,
        onSaved: () => {
          toast({
            title: 'Integration saved',
            description: "The tenant's customers were updated.",
            variant: 'success',
          });
          back();
        },
      });
    });
  };

  return { attributionForm: attribution.form, handleSave, isSaving };
}
