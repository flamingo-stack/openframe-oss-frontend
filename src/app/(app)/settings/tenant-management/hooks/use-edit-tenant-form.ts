'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { getErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import type { TenantConnection, UpdateTenantConnectionInput } from '../types/tenant-connection';
import { editTenantFormSchema, TENANT_FORM_DEFAULT_VALUES, type TenantFormData } from '../types/tenant-form.types';
import { connectionToFormValues, invalidSubmitHandler } from '../utils/tenant-form-helpers';
import { useUpdateTenantConnection } from './use-tenant-connections';

/**
 * The Edit page's form (Figma 2097-123264): real from the first paint, seeded by `useSeedForm` in the
 * `useForm` owner. Provider and domain ride along hidden and unvalidated; only changed name/customer are sent.
 */
export function useEditTenantForm(connection: TenantConnection | null) {
  const { toast } = useToast();
  const router = useRouter();
  const update = useUpdateTenantConnection();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(editTenantFormSchema),
    defaultValues: TENANT_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });
  const { handleSubmit } = form;

  // Identity matters: `useSeedForm` seeds once per VALUES object, so this must
  // change only when the record does — a fresh object per render would reseed
  // on every commit until the user typed something.
  const seed = useMemo(() => (connection ? connectionToFormValues(connection) : null), [connection]);
  useSeedForm(form, seed);

  const { mutateAsync: updateAsync, isPending } = update;

  const onValid = useCallback(
    async (values: TenantFormData) => {
      if (!connection) return;
      const input: UpdateTenantConnectionInput = {};
      if (values.name !== connection.name) input.name = values.name;
      if (values.organizationId !== connection.organizationId) input.organizationId = values.organizationId;
      try {
        if (Object.keys(input).length > 0) {
          await updateAsync({ id: connection.id, input });
        }
        toast({ title: 'Integration saved', description: `${values.name} was updated.`, variant: 'success' });
        safeBackOrReplace(router, routes.settings.tenantDetails(connection.id));
      } catch (error) {
        toast({
          title: 'Could not save the integration',
          description: getErrorMessage(error) || 'Try again in a moment.',
          variant: 'destructive',
        });
      }
    },
    [connection, updateAsync, toast, router],
  );

  const handleSave = useCallback(() => {
    void handleSubmit(onValid, invalidSubmitHandler(toast, 'Cannot save yet'))();
  }, [handleSubmit, onValid, toast]);

  return { form, isSubmitting: isPending, handleSave };
}
