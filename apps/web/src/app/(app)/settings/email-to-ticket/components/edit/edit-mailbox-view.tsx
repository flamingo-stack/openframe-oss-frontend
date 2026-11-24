'use client';
'use no memo';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  NotFoundError,
  type PageActionButton,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { editMailboxViewMutation as UpdateMutationType } from '@/__generated__/editMailboxViewMutation.graphql';
import type { editMailboxViewQuery as EditMailboxViewQueryType } from '@/__generated__/editMailboxViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { MailboxReceivingState } from '@/generated/schema-enums';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { getFullImageUrl } from '@/lib/image-url';
import { rawIdOf } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import {
  EMPTY_MAILBOX_DEFAULTS,
  type MailboxDefaultsFormData,
  mailboxDefaultsSchema,
} from '../form/mailbox-defaults.types';

export const EDIT_MAILBOX_TITLE = 'Edit Mailbox';
const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Mailbox', variant: 'accent', disabled: true };

// The defaults as the form holds them: raw ids, the ones the pickers' options carry.
const editMailboxViewQuery = graphql`
  query editMailboxViewQuery($id: ID!) {
    mailbox(id: $id) {
      id
      supportAddress
      receivingState
      defaultOrganization {
        organizationId
        name
        image {
          imageUrl
          hash
        }
      }
      defaultStatus {
        id
        name
        color
      }
      defaultAssignee {
        ...userSummaryFields_user
      }
    }
  }
`;

// Selects what the details page reads, so it shows the saved values on arrival.
const updateMutation = graphql`
  mutation editMailboxViewMutation($input: UpdateMailboxInput!) {
    updateMailbox(input: $input) {
      mailbox {
        id
        ...mailboxSummaryCard_mailbox
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

function EditFrame({ actions = [SAVE_PLACEHOLDER], children }: { actions?: PageActionButton[]; children: ReactNode }) {
  const handleBack = useSafeBack(routes.settings.emailToTicket.list);
  return (
    <PageLayout
      title={EDIT_MAILBOX_TITLE}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">{children}</div>
    </PageLayout>
  );
}

/**
 * `/settings/email-to-ticket/edit?id=` (Figma 4679-130269): the routing defaults of new tickets.
 *
 * Not drawn yet, waiting on the backend: the send-only sign-in card (`startSendAsSignIn` / `signOutSendAs` answer
 * NOT_IMPLEMENTED until CU-17tkuw66n95) and the Block List (its storage is CU-17tkuw66n9x).
 */
export function EditMailboxView({ id, loading = false }: { id: string; loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading mailbox" gated={loading}>
      <EditMailboxReader id={id} />
    </LoadingSuspense>
  );
}

function EditMailboxReader({ id }: { id: string }) {
  if (useLoadingScope()) return <LoadingEditForm />;
  return <EditMailboxQuery id={id} />;
}

/** While the record is read: the real fields over an empty form, locked; nothing fetches and nothing submits. */
function LoadingEditForm() {
  const form = useForm<MailboxDefaultsFormData>({ defaultValues: EMPTY_MAILBOX_DEFAULTS });
  return (
    <EditFrame>
      <MailboxDefaultsFields control={form.control} setValue={form.setValue} disabled />
    </EditFrame>
  );
}

function EditMailboxQuery({ id }: { id: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { mailbox } = useLazyLoadQuery<EditMailboxViewQueryType>(
    editMailboxViewQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const pending = mailbox?.receivingState === MailboxReceivingState.PENDING;
  useEffect(() => {
    if (pending) router.replace(routes.settings.emailToTicket.new({ id }));
  }, [pending, id, router]);

  if (!mailbox) {
    return (
      <EditFrame>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </EditFrame>
    );
  }
  // On its way to the setup page: the form as it loads, not a blank page.
  if (pending) return <LoadingEditForm />;
  return <EditMailboxForm key={mailbox.id} mailbox={mailbox} />;
}

type EditableMailbox = NonNullable<EditMailboxViewQueryType['response']['mailbox']>;

function EditMailboxForm({ mailbox }: { mailbox: EditableMailbox }) {
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isSaving] = useMutation<UpdateMutationType>(updateMutation);
  const customer = mailbox.defaultOrganization;
  const form = useForm<MailboxDefaultsFormData>({
    resolver: zodResolver(mailboxDefaultsSchema),
    defaultValues: {
      ...EMPTY_MAILBOX_DEFAULTS,
      defaultOrganizationId: customer?.organizationId ?? null,
      defaultStatusId: mailbox.defaultStatus ? rawIdOf(mailbox.defaultStatus.id) : null,
      defaultAssigneeId: mailbox.defaultAssignee ? toUserSummary(mailbox.defaultAssignee).rawId : null,
    },
  });

  const save = form.handleSubmit(values => {
    commit({
      // Every value is sent: null clears a default (contract part A, `updateMailbox` replaces all three).
      variables: { input: { mailboxId: mailbox.id, ...values } },
      onCompleted: ({ updateMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          toast({
            title: 'Could not save the mailbox',
            description: mailboxUserErrorMessage(refusal),
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Mailbox saved',
          description: 'New tickets from this mailbox use these defaults.',
          variant: 'success',
        });
        router.replace(routes.settings.emailToTicket.details(mailbox.id));
      },
      onError: error => {
        toast({
          title: 'Could not save the mailbox',
          description: mailboxRequestErrorMessage(error),
          variant: 'destructive',
        });
      },
    });
  });

  return (
    <EditFrame actions={[{ ...SAVE_PLACEHOLDER, disabled: isSaving, loading: isSaving, onClick: save }]}>
      <MailboxDefaultsFields
        control={form.control}
        setValue={form.setValue}
        disabled={isSaving}
        storedCustomer={
          customer
            ? {
                value: customer.organizationId,
                label: customer.name,
                imageUrl: getFullImageUrl(customer.image?.imageUrl, customer.image?.hash),
              }
            : null
        }
        storedStatus={
          mailbox.defaultStatus
            ? {
                value: rawIdOf(mailbox.defaultStatus.id),
                label: mailbox.defaultStatus.name,
                color: mailbox.defaultStatus.color,
              }
            : null
        }
      />
    </EditFrame>
  );
}
