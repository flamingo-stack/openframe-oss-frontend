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
import { useMountedRef } from '../shared/use-mounted-ref';
import { changedFields, invalidSubmitHandler } from '../tenant-form/tenant-form-helpers';
import {
  editTenantFormSchema,
  TENANT_FORM_DEFAULT_VALUES,
  type TenantFormData,
} from '../tenant-form/tenant-form.types';

// Selects every field the update can change, so the list row, the details card and this page update in place.
const updateMutation = graphql`
  mutation useEditTenantFormUpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        id
        name
        domain
        organizationId
        organization {
          organizationId
          name
          image {
            imageUrl
            hash
          }
        }
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
  // Set on the click: the in-flight flag disables Save only after a re-render (canon `use-customer-form`).
  const inFlightRef = useRef(false);
  const mountedRef = useMountedRef();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(editTenantFormSchema),
    defaultValues: TENANT_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });
  useSeedForm(form, stored);

  const onValid = (values: TenantFormData) => {
    if (!stored) {
      inFlightRef.current = false;
      return;
    }
    const saved = () => {
      toast({ title: 'Integration saved', description: `${values.name} was updated.`, variant: 'success' });
      // The update outlives the page: a user who already left must not be sent one more step back.
      if (mountedRef.current) safeBackOrReplace(router, routes.settings.tenantDetails(id));
    };
    const input = changedFields(values, stored, ['name', 'organizationId']);
    if (Object.keys(input).length === 0) {
      inFlightRef.current = false;
      saved();
      return;
    }
    commitUpdate({
      variables: { connectionId: id, input },
      onCompleted: ({ updateDirectoryConnection: { userErrors } }) => {
        inFlightRef.current = false;
        const [refusal] = userErrors;
        if (refusal) {
          toast({
            title: SAVE_FAILED,
            description: refusal.message || 'Try again in a moment.',
            variant: 'destructive',
          });
          return;
        }
        saved();
      },
      onError: error => {
        inFlightRef.current = false;
        toast({
          title: SAVE_FAILED,
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
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
