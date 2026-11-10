'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { graphql, useMutation } from 'react-relay';
import type { useEditUserFormMutation as EditUserMutationType } from '@/__generated__/useEditUserFormMutation.graphql';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { useGuardedSubmit, userErrorsDescription } from '@/lib/form-save';
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

// Selects what the user page reads. The accounts have ids, so their fields update in place and the page shows them as
// soon as the form closes onto it; the person has none, so its own fields (the title's name, the customers) are stored
// under this mutation and wait for the page's `store-and-network` refetch.
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
 * The Edit User form (Figma 1040:37391): real from the first paint, seeded from `loaded` by its `useForm` owner. The
 * page is compiled and only passes `form` through.
 *
 * `record` is the one the form was seeded from: the page draws the fields, their locks and the notice from it, and Save
 * validates and diffs against it. A refetch that lands on a dirty form does not reseed it, so it must not unlock a
 * field Save would then drop, nor become Save's baseline, or every untouched field would read as changed.
 */
export function useEditUserForm(loaded: EditUserRecord | null) {
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isSaving] = useMutation<EditUserMutationType>(editUserMutation);
  const submit = useGuardedSubmit();

  // Assigned below: validation runs after the render, by when this is the record the render seeded.
  let record: EditUserRecord | null = null;
  const form = useForm<EditUserFormData>({
    resolver: (values, context, options) =>
      zodResolver(editUserSchema(record?.values.usageLocation ?? ''))(values, context, options),
    defaultValues: EDIT_USER_DEFAULT_VALUES,
    mode: 'onChange',
  });
  record = useSeedForm(form, loaded, seeded => seeded.values);

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
    const stored = record;
    // The seeded record outlives the read: once a refetch finds no user, there is nothing left to save against.
    if (!loaded || !stored) return;
    submit<EditUserFormData>(
      'Cannot save yet',
      (pass, fail) => void form.handleSubmit(pass, fail)(),
      values => save(stored, values),
    );
  };

  return { form, record, isSubmitting: isSaving, handleSave };
}
