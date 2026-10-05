'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useConnectTenantFormUpdateMutation as UpdateMutationType } from '@/__generated__/useConnectTenantFormUpdateMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { isReadable } from '../../utils/tenant-presentation';
import { useCheckConnection } from '../consent/use-check-connection';
import { useStartConsent } from '../consent/use-start-consent';
import {
  changedFields,
  type EditableField,
  invalidSubmitHandler,
  type TenantFormRecord,
} from '../tenant-form/tenant-form-helpers';
import { type TenantFormData, tenantFormSchema } from '../tenant-form/tenant-form.types';

// Selects the shared record: the fields here, the list row and the details card all update in place.
const updateMutation = graphql`
  mutation useConnectTenantFormUpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
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

const SAVE_FIELDS: readonly EditableField[] = ['name', 'organizationId'];
const GENERATE_FIELDS: readonly EditableField[] = ['name', 'organizationId', 'domain'];

/**
 * The connect step's form (Figma 2097-122222 → 122274), over a record the store already holds.
 * Save writes a changed name or customer and leaves for the details page. Edit Domain unlocks the
 * domain; the Generate that follows writes what changed and mints a fresh link — the old one is
 * void once the tenant segment of its URL changes.
 */
export function useConnectTenantForm(record: TenantFormRecord) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateMutation);
  // A created record with no link (the provider was unreachable at creation) gets one here.
  const consent = useStartConsent(record.id, { autoMintWhen: !record.consentUrl && !record.connected });
  const check = useCheckConnection(record.id);
  const [editingDomain, setEditingDomain] = useState(false);
  // Set on the click: `handleSubmit` awaits the resolver, so a second click can land before the
  // in-flight flags disable the buttons (canon `use-customer-form`). Cleared once the write starts.
  const inFlightRef = useRef(false);

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: record.values,
    mode: 'onChange',
  });

  const connected = record.connected || (check.verdict?.kind === 'answered' && isReadable(check.verdict.access.state));

  const update = (input: Partial<Pick<TenantFormData, EditableField>>, title: string, onWritten: () => void) => {
    if (Object.keys(input).length === 0) {
      onWritten();
      return;
    }
    const fail = (message: string) => {
      toast({ title, description: message, variant: 'destructive' });
    };
    commitUpdate({
      variables: { connectionId: record.id, input },
      onCompleted: ({ updateDirectoryConnection: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) fail(refusal.message || 'Try again in a moment.');
        else onWritten();
      },
      onError: error => fail(getRelayErrorMessage(error, 'Try again in a moment.')),
    });
  };

  const submit = (onValid: (values: TenantFormData) => void, invalidTitle: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const onInvalid = invalidSubmitHandler(toast, invalidTitle);
    void form.handleSubmit(
      values => {
        inFlightRef.current = false;
        onValid(values);
      },
      errors => {
        inFlightRef.current = false;
        onInvalid(errors);
      },
    )();
  };

  const generateLink = () =>
    submit(values => {
      // An unchanged domain is left out: the API refuses it once the admin has consented.
      update(changedFields(values, record.values, GENERATE_FIELDS), 'Could not generate the link', () =>
        consent.mint(() => {
          check.reset();
          setEditingDomain(false);
        }),
      );
    }, 'Cannot generate the link yet');

  const handleSave = () =>
    submit(values => {
      update(changedFields(values, record.values, SAVE_FIELDS), 'Could not save the integration', () => {
        // Saving connects nothing: only a readable probe means the admin has consented.
        toast({
          title: 'Integration saved',
          description: connected
            ? `${values.name} is connected and readable.`
            : `${values.name} stays disconnected until the customer's admin grants consent — check the connection from its page.`,
          variant: 'success',
        });
        router.replace(routes.cloudTenantManagement.details(record.id));
      });
    }, 'Cannot save yet');

  const editDomain = () => {
    check.reset();
    setEditingDomain(true);
  };

  return {
    form,
    editingDomain,
    // Once the directory accepted the consent the domain is what it granted for, so the action is gone.
    editDomain: connected ? undefined : editDomain,
    generateLink,
    handleSave,
    isGenerating: editingDomain && (isUpdating || consent.isMinting),
    isSaving: !editingDomain && isUpdating,
    isMinting: consent.isMinting,
    mintFailed: consent.mintFailed,
    retryMint: () => consent.mint(),
    check,
  };
}
