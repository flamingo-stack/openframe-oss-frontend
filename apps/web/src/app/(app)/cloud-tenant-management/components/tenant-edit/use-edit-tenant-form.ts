'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useEditTenantFormUpdateMutation as UpdateMutationType } from '@/__generated__/useEditTenantFormUpdateMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { changedFields, invalidSubmitHandler } from '../tenant-form/tenant-form-helpers';
import {
  editTenantFormSchema,
  TENANT_FORM_DEFAULT_VALUES,
  type TenantFormData,
} from '../tenant-form/tenant-form.types';

// Selects the shared record: this page, the list row and the details card all update in place.
const updateMutation = graphql`
  mutation useEditTenantFormUpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        id
        ...tenantFormHelpers_connection
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const SAVE_FAILED = 'Could not save the integration';

/**
 * The Edit page's form (Figma 2097-123264): real from the first paint, seeded from `stored` by the
 * `useForm` owner. Provider and domain ride along hidden and unvalidated; only a changed name or customer is sent.
 */
export function useEditTenantForm(id: string, stored: TenantFormData | null) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitUpdate, isInFlight] = useMutation<UpdateMutationType>(updateMutation);
  // Set on the click: `handleSubmit` awaits the resolver, so a second click can land before
  // `isInFlight` disables Save (canon `use-customer-form`). Cleared once the write starts.
  const inFlightRef = useRef(false);

  const form = useForm<TenantFormData>({
    resolver: zodResolver(editTenantFormSchema),
    defaultValues: TENANT_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });
  useSeedForm(form, stored);

  const onValid = (values: TenantFormData) => {
    inFlightRef.current = false;
    if (!stored) return;
    const saved = () => {
      toast({ title: 'Integration saved', description: `${values.name} was updated.`, variant: 'success' });
      safeBackOrReplace(router, routes.cloudTenantManagement.details(id));
    };
    const input = changedFields(values, stored, ['name', 'organizationId']);
    if (Object.keys(input).length === 0) {
      saved();
      return;
    }
    const fail = (message: string) => {
      toast({ title: SAVE_FAILED, description: message, variant: 'destructive' });
    };
    commitUpdate({
      variables: { connectionId: id, input },
      onCompleted: ({ updateDirectoryConnection: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) fail(refusal.message || 'Try again in a moment.');
        else saved();
      },
      onError: error => fail(getRelayErrorMessage(error, 'Try again in a moment.')),
    });
  };

  const handleSave = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const onInvalid = invalidSubmitHandler(toast, 'Cannot save yet');
    void form.handleSubmit(onValid, errors => {
      inFlightRef.current = false;
      onInvalid(errors);
    })();
  };

  return { form, isSubmitting: isInFlight, handleSave };
}
