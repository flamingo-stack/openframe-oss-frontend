'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { invalidSubmitHandler } from '../tenant-form/tenant-form-helpers';
import { TENANT_FORM_DEFAULT_VALUES, type TenantFormData, tenantFormSchema } from '../tenant-form/tenant-form.types';
import { type NewTenantHandoff, useNewTenantFlow } from './use-new-tenant-flow';

/**
 * The react-hook-form half of the New page: owns the form, validates on the way
 * into the flow machine (`useNewTenantFlow`), and turns an invalid attempt into
 * the toast + scroll every form here does.
 */
export function useNewTenantForm(initial: NewTenantHandoff | null, onCreated: (handoff: NewTenantHandoff) => void) {
  const { toast } = useToast();
  const flow = useNewTenantFlow({ initial, onCreated });

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: initial?.values ?? TENANT_FORM_DEFAULT_VALUES,
    // `onChange` lets a field clear its own error as soon as it is valid, and
    // keeps `formState.isValid` live for the Generate button.
    mode: 'onChange',
  });
  const { handleSubmit } = form;
  const { generate, save } = flow;

  const generateLink = useCallback(() => {
    void handleSubmit(generate, invalidSubmitHandler(toast, 'Cannot generate the link yet'))();
  }, [handleSubmit, generate, toast]);

  const handleSave = useCallback(() => {
    void handleSubmit(save, invalidSubmitHandler(toast, 'Cannot save yet'))();
  }, [handleSubmit, save, toast]);

  return { form, flow, generateLink, handleSave };
}
