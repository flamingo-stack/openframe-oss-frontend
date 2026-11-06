'use client';
'use no memo';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-edit/use-edit-tenant-form.ts, rendered while tenant-management-v2 is off. Deleted with the flag.

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useEditTenantFormV1UpdateMutation as UpdateMutationType } from '@/__generated__/useEditTenantFormV1UpdateMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { changedFieldsV1, invalidSubmitHandlerV1 } from '../tenant-form/tenant-form-helpers-v1';
import {
  editTenantFormSchemaV1,
  TENANT_FORM_DEFAULT_VALUES_V1,
  type TenantFormDataV1,
} from '../tenant-form/tenant-form-v1.types';

// Selects the shared record: this page, the list row and the details card all update in place.
const updateMutation = graphql`
  mutation useEditTenantFormV1UpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        id
        ...tenantFormHelpersV1_connection
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
export function useEditTenantFormV1(id: string, stored: TenantFormDataV1 | null) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitUpdate, isInFlight] = useMutation<UpdateMutationType>(updateMutation);
  // Set on the click: `handleSubmit` awaits the resolver, so a second click can land before
  // `isInFlight` disables Save (canon `use-customer-form`). Cleared once the write starts.
  const inFlightRef = useRef(false);

  const form = useForm<TenantFormDataV1>({
    resolver: zodResolver(editTenantFormSchemaV1),
    defaultValues: TENANT_FORM_DEFAULT_VALUES_V1,
    mode: 'onChange',
  });
  useSeedForm(form, stored);

  const onValid = (values: TenantFormDataV1) => {
    inFlightRef.current = false;
    if (!stored) return;
    const saved = () => {
      toast({ title: 'Integration saved', description: `${values.name} was updated.`, variant: 'success' });
      safeBackOrReplace(router, routes.cloudTenantManagement.details(id));
    };
    const input = changedFieldsV1(values, stored, ['name', 'organizationId']);
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
    const onInvalid = invalidSubmitHandlerV1(toast, 'Cannot save yet');
    void form.handleSubmit(onValid, errors => {
      inFlightRef.current = false;
      onInvalid(errors);
    })();
  };

  return { form, isSubmitting: isInFlight, handleSave };
}
