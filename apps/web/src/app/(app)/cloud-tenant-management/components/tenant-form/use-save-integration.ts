'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef } from 'react';
import type { FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type {
  useSaveIntegrationMutation as SaveIntegrationMutationType,
  UpdateDirectoryConnectionInput,
} from '@/__generated__/useSaveIntegrationMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import {
  attributionChanged,
  attributionToInput,
  type TenantUserError,
  userErrorsDescription,
} from './attribution-helpers';
import type { AttributionFormData } from './attribution.types';
import { type EditableField, invalidSubmitHandler } from './tenant-form-helpers';
import type { TenantFormData } from './tenant-form.types';

// The writes of Connect, Edit and Reconnect: the connection's changed fields and, when they changed,
// its whole set of customers, in one `updateDirectoryConnection`.

// Selects the shared record, so the form, the list row and the details card update in place, and the rules table's
// counts: a rule has no id, so a count the save left behind would sit on whichever rule now holds its place.
const saveIntegrationMutation = graphql`
  mutation useSaveIntegrationMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        id
        ...tenantFormHelpers_connection
        ...tenantAttributionRules_connection
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

const SAVE_FAILED = 'Could not save the integration';

/**
 * What Save sends: the changed fields, plus `customers` only when the attribution form is in play and differs from
 * what is stored — leaving it out is what keeps the stored set (and the customers the form cannot send back) as is.
 */
export function integrationInput(
  changes: Partial<Pick<TenantFormData, EditableField>>,
  attribution: AttributionFormData | null,
  stored: AttributionFormData,
): UpdateDirectoryConnectionInput {
  return attribution && attributionChanged(attribution, stored)
    ? { ...changes, customers: attributionToInput(attribution) }
    : changes;
}

/**
 * One submit at a time: validates `form` and, when given, the attribution form beside it, then hands both values
 * on; an invalid one is toasted under `invalidTitle`. An invalid `form` still shows the customers' problems, so the
 * user sees them all at once. The guard is set on the click — `handleSubmit` awaits the resolver, so a second click
 * can land before the write's in-flight flag disables the button (canon `use-customer-form`) — and cleared once
 * validation has answered.
 */
export function useSubmitWithAttribution() {
  const { toast } = useToast();
  const inFlightRef = useRef(false);

  return <T extends FieldValues>(
    form: UseFormReturn<T>,
    attribution: UseFormReturn<AttributionFormData> | null,
    invalidTitle: string,
    onValid: (values: T, attribution: AttributionFormData | null) => void,
  ) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const onInvalid = invalidSubmitHandler(toast, invalidTitle);
    const pass = (values: T, attributionValues: AttributionFormData | null) => {
      inFlightRef.current = false;
      onValid(values, attributionValues);
    };
    const fail = (errors: FieldErrors) => {
      inFlightRef.current = false;
      onInvalid(errors);
    };
    void form.handleSubmit(
      values => {
        if (!attribution) {
          pass(values, null);
          return;
        }
        void attribution.handleSubmit(attributionValues => pass(values, attributionValues), fail)();
      },
      errors => {
        if (attribution) void attribution.trigger();
        fail(errors);
      },
    )();
  };
}

interface SaveCallbacks {
  onSaved: () => void;
  /** Puts the refusals the attribution form draws on their fields (`useAttributionForm`); Generate sends no customers. */
  placeUserErrors?: (errors: readonly TenantUserError[]) => void;
}

/** The connection's write; `failureTitle` heads the toast of a refused or failed one. */
export function useSaveIntegration(connectionId: string, failureTitle = SAVE_FAILED) {
  const { toast } = useToast();
  const [commit, isSaving] = useMutation<SaveIntegrationMutationType>(saveIntegrationMutation);

  /** Writes `input`; with nothing to write it is saved at once. A refusal is toasted and shown on its field. */
  const save = (input: UpdateDirectoryConnectionInput, { onSaved, placeUserErrors }: SaveCallbacks) => {
    if (Object.keys(input).length === 0) {
      onSaved();
      return;
    }
    commit({
      variables: { connectionId, input },
      onCompleted: ({ updateDirectoryConnection: { userErrors } }) => {
        if (userErrors.length === 0) {
          onSaved();
          return;
        }
        placeUserErrors?.(userErrors);
        toast({ title: failureTitle, description: userErrorsDescription(userErrors), variant: 'destructive' });
        scrollToFirstInvalidField();
      },
      onError: error => {
        toast({
          title: failureTitle,
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };

  return { save, isSaving };
}
