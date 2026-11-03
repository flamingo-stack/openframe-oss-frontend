'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useEditUserFormMutation as EditUserMutationType } from '@/__generated__/useEditUserFormMutation.graphql';
import { userErrorsDescription } from '@/app/(app)/cloud-tenant-management/components/tenant-form/attribution-helpers';
import { invalidSubmitHandler } from '@/app/(app)/cloud-tenant-management/components/tenant-form/tenant-form-helpers';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import {
  EDIT_USER_DEFAULT_VALUES,
  type EditUserFormData,
  type EditUserRecord,
  editUserSchema,
  formFieldOfInput,
  toUpdateInput,
} from './edit-user-form';

// Selects what the user page reads, so it shows the saved values as soon as the form closes onto it.
const editUserMutation = graphql`
  mutation useEditUserFormMutation($input: UpdateDirectoryUserInput!) {
    updateDirectoryUser(input: $input) {
      person {
        ...userDetailHeader_person
        ...userDetailsTab_person
        ...editUserForm_person
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

const SAVE_FAILED = 'Could not save the user';

/** The provider took the write; its re-read does not show it yet. */
const SYNC_PENDING = 'SYNC_PENDING';

/**
 * The Edit User form (Figma 1040:37391): real from the first paint, seeded from `record` by its `useForm` owner. The
 * page is compiled and only passes `form` through; everything it reads per render comes back as a primitive.
 */
export function useEditUserForm(record: EditUserRecord | null) {
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isSaving] = useMutation<EditUserMutationType>(editUserMutation);
  // `handleSubmit` awaits the resolver, so a second click can land before `isSaving` disables the button.
  const validatingRef = useRef(false);

  const form = useForm<EditUserFormData>({
    // Read on every validation (`control._options`), so it follows the stored value once the record lands.
    resolver: zodResolver(editUserSchema(record?.values.usageLocation ?? '')),
    defaultValues: EDIT_USER_DEFAULT_VALUES,
    mode: 'onChange',
  });
  useSeedForm(form, record?.values ?? null);

  const save = (stored: EditUserRecord, values: EditUserFormData) => {
    const leave = () => safeBackOrReplace(router, routes.users.details(stored.accountId));
    const input = toUpdateInput(stored, values);
    if (!input) {
      leave();
      return;
    }
    commit({
      variables: { input },
      onCompleted: ({ updateDirectoryUser: { person, userErrors } }) => {
        if (userErrors.length === 0) {
          const name = input.displayName ?? stored.displayName;
          toast({ title: 'User updated', description: `${name} was updated.`, variant: 'success' });
          leave();
          return;
        }
        // The write landed and only part of it shows: its re-read lags, or the manager change failed (contract §4).
        if (person) {
          const lagging = userErrors.every(({ code }) => code === SYNC_PENDING);
          toast({
            title: lagging ? 'User updated' : 'User partly updated',
            description: userErrorsDescription(userErrors),
            variant: 'warning',
          });
          leave();
          return;
        }
        for (const { field, message } of userErrors) {
          const formField = formFieldOfInput(field);
          if (formField) form.setError(formField, { type: 'server', message });
        }
        toast({ title: SAVE_FAILED, description: userErrorsDescription(userErrors), variant: 'destructive' });
        scrollToFirstInvalidField();
      },
      onError: error => {
        toast({
          title: SAVE_FAILED,
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };

  const handleSave = () => {
    if (!record || validatingRef.current) return;
    validatingRef.current = true;
    const onInvalid = invalidSubmitHandler<EditUserFormData>(toast, 'Cannot save yet');
    void form.handleSubmit(
      values => {
        validatingRef.current = false;
        save(record, values);
      },
      errors => {
        validatingRef.current = false;
        onInvalid(errors);
      },
    )();
  };

  return { form, isSubmitting: isSaving, handleSave };
}
