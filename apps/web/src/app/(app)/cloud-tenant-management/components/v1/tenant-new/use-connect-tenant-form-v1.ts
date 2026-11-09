'use client';
'use no memo';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-new/use-connect-tenant-form.ts, rendered while tenant-management-v2 is off. Deleted with the flag.

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useConnectTenantFormV1UpdateMutation as UpdateMutationType } from '@/__generated__/useConnectTenantFormV1UpdateMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { isReadable } from '../../../utils/tenant-presentation';
import { useCheckConnection } from '../../consent/use-check-connection';
import { useStartConsent } from '../../consent/use-start-consent';
import {
  changedFieldsV1,
  type EditableFieldV1,
  invalidSubmitHandlerV1,
  type TenantFormRecordV1,
} from '../tenant-form/tenant-form-helpers-v1';
import { type TenantFormDataV1, tenantFormSchemaV1 } from '../tenant-form/tenant-form-v1.types';

// Selects the shared record: the fields here, the list row and the details card all update in place.
const updateMutation = graphql`
  mutation useConnectTenantFormV1UpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
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

const SAVE_FIELDS: readonly EditableFieldV1[] = ['name', 'organizationId'];
const GENERATE_FIELDS: readonly EditableFieldV1[] = ['name', 'organizationId', 'domain'];

/**
 * The connect step's form (Figma 2097-122222 → 122274), over a record the store already holds.
 * Save writes a changed name or customer and leaves for the details page. Edit Domain unlocks the
 * domain; the Generate that follows writes what changed and mints a fresh link — the old one is
 * void once the tenant segment of its URL changes.
 */
export function useConnectTenantFormV1(record: TenantFormRecordV1) {
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

  const form = useForm<TenantFormDataV1>({
    resolver: zodResolver(tenantFormSchemaV1),
    defaultValues: record.values,
    mode: 'onChange',
  });

  const connected = record.connected || (check.verdict?.kind === 'answered' && isReadable(check.verdict.access.state));

  const update = (input: Partial<Pick<TenantFormDataV1, EditableFieldV1>>, title: string, onWritten: () => void) => {
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

  const submit = (onValid: (values: TenantFormDataV1) => void, invalidTitle: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const onInvalid = invalidSubmitHandlerV1(toast, invalidTitle);
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
      update(changedFieldsV1(values, record.values, GENERATE_FIELDS), 'Could not generate the link', () =>
        consent.mint(() => {
          check.reset();
          setEditingDomain(false);
        }),
      );
    }, 'Cannot generate the link yet');

  const handleSave = () =>
    submit(values => {
      update(changedFieldsV1(values, record.values, SAVE_FIELDS), 'Could not save the integration', () => {
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
