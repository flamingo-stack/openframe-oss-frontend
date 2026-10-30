'use client';
'use no memo';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { type FieldPath, useForm, type UseFormReturn } from 'react-hook-form';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { attributionFieldPath, type TenantUserError } from './attribution-helpers';
import { type AttributionFormData, attributionFormSchema } from './attribution.types';

/** The error type of a refusal `placeUserErrors` puts on a field; the watcher's re-check leaves those alone. */
const SERVER_ERROR = 'server';

/**
 * The customers' fields showing a validation error now, read live (`getFieldState`; `formState` is the last render's).
 * A refusal from the server is left alone: only the next save can tell whether it still holds.
 */
function shownErrorPaths(form: UseFormReturn<AttributionFormData>): FieldPath<AttributionFormData>[] {
  return form.getValues('customers').flatMap((customer, i) => {
    const paths: FieldPath<AttributionFormData>[] = [
      `customers.${i}.organizationId`,
      ...customer.rules.flatMap(
        (_rule, j) => [`customers.${i}.rules.${j}.kind`, `customers.${i}.rules.${j}.values`] as const,
      ),
    ];
    return paths.filter(path => {
      const { error } = form.getFieldState(path);
      return error != null && error.type !== SERVER_ERROR;
    });
  });
}

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

  // Two rules (All accounts beside another customer, a value in two rules) put their error on a field other than the
  // one that fixes them, and react-hook-form re-checks only the field that changed: a change in the customers re-checks
  // every field showing an error, so a fixed clash clears. Only those: a row just added stays clean.
  useEffect(() => {
    const { unsubscribe } = form.watch((_values, { name }) => {
      if (!name?.startsWith('customers')) return;
      // A microtask on, the change's own handler has finished: a "Match by" change has cleared its values' error.
      queueMicrotask(() => {
        const paths = shownErrorPaths(form);
        // A list, not 'customers': only these fields are rewritten, and react-hook-form re-renders every Controller.
        if (paths.length > 0) void form.trigger(paths);
      });
    });
    return unsubscribe;
  }, [form]);

  /** Puts each refusal the form draws on its field, so it shows where the user fixes it. */
  const placeUserErrors = (errors: readonly TenantUserError[]) => {
    const mode = form.getValues('mode');
    for (const error of errors) {
      const path = attributionFieldPath(error.field, mode);
      if (path) form.setError(path, { type: SERVER_ERROR, message: error.message });
    }
  };

  return { form, placeUserErrors };
}
