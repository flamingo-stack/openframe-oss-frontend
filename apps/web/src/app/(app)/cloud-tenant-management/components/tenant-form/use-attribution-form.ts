'use client';
'use no memo';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { attributionFieldPath, type TenantUserError } from './attribution-helpers';
import { type AttributionFormData, attributionFormSchema } from './attribution.types';

/**
 * The "Customers and attribution" form of Connect, Edit and Reconnect. `initial` fills it on mount (Connect and
 * Reconnect have their record by then); `seed` fills it once the record arrives (Edit renders before it does).
 */
export function useAttributionForm(initial: AttributionFormData, seed: AttributionFormData | null = null) {
  const form = useForm<AttributionFormData>({
    resolver: zodResolver(attributionFormSchema),
    defaultValues: initial,
    mode: 'onChange',
  });
  useSeedForm(form, seed);

  /** Puts each refusal the form draws on its field, so it shows where the user fixes it. */
  const placeUserErrors = (errors: readonly TenantUserError[]) => {
    const mode = form.getValues('mode');
    for (const error of errors) {
      const path = attributionFieldPath(error.field, mode);
      if (path) form.setError(path, { type: 'server', message: error.message });
    }
  };

  return { form, placeUserErrors };
}
