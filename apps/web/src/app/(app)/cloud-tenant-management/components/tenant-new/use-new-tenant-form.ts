'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useNewTenantFormCreateMutation as CreateMutationType } from '@/__generated__/useNewTenantFormCreateMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { invalidSubmitHandler } from '../tenant-form/tenant-form-helpers';
import { TENANT_FORM_DEFAULT_VALUES, type TenantFormData, tenantFormSchema } from '../tenant-form/tenant-form.types';

// Selects what the connect step renders, so the page it navigates to reads the store instead of
// fetching the record it just created; the updater links it under the id lookup that page runs.
const createMutation = graphql`
  mutation useNewTenantFormCreateMutation($input: CreateDirectoryConnectionInput!) {
    createDirectoryConnection(input: $input) {
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

const CREATE_FAILED = 'Could not generate the link';

/**
 * The New page's form (Figma 2097-122192): provider, domain, name and customer, submitted by
 * "Generate Connection Link". The API persists the connection and mints its link in that one call,
 * so success is a hand-off to the connect step on the new id — there is nothing to hold here.
 */
export function useNewTenantForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [commitCreate, isCreating] = useMutation<CreateMutationType>(createMutation);
  // Set on the click: `handleSubmit` awaits the resolver, so a second click can land before
  // `isCreating` disables the button (canon `use-customer-form`). Cleared once the write starts.
  const inFlightRef = useRef(false);

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: TENANT_FORM_DEFAULT_VALUES,
    // `onChange` lets a field clear its own error as soon as it is valid, and keeps
    // `formState.isValid` live for the Generate button.
    mode: 'onChange',
  });

  const onValid = (values: TenantFormData) => {
    inFlightRef.current = false;
    commitCreate({
      variables: { input: values },
      updater: store => {
        const created = store.getRootField('createDirectoryConnection').getLinkedRecord('connection');
        if (created) {
          store.getRoot().setLinkedRecord(created, 'directoryConnection', { connectionId: created.getValue('id') });
        }
      },
      onCompleted: ({ createDirectoryConnection: { connection, userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal || !connection) {
          toast({
            title: CREATE_FAILED,
            description: refusal?.message || 'Try again in a moment.',
            variant: 'destructive',
          });
          return;
        }
        // The record exists from here on: the address carries it, so a reload or Back resumes it.
        router.replace(routes.cloudTenantManagement.new({ id: connection.id }));
      },
      onError: error => {
        toast({
          title: CREATE_FAILED,
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };

  const generateLink = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const onInvalid = invalidSubmitHandler(toast, 'Cannot generate the link yet');
    void form.handleSubmit(onValid, errors => {
      inFlightRef.current = false;
      onInvalid(errors);
    })();
  };

  return { form, isCreating, generateLink };
}
