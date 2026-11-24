'use client';
'use no memo';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Button,
  LoadingScope,
  NotFoundError,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { pendingMailboxSetupActivateMutation as ActivateMutationType } from '@/__generated__/pendingMailboxSetupActivateMutation.graphql';
import type { pendingMailboxSetupProviderMutation as ProviderMutationType } from '@/__generated__/pendingMailboxSetupProviderMutation.graphql';
import type { pendingMailboxSetupQuery as PendingMailboxSetupQueryType } from '@/__generated__/pendingMailboxSetupQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { ForwardingTestState, MailboxProvider, MailboxReceivingState } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import {
  EMPTY_MAILBOX_DEFAULTS,
  type MailboxDefaultsFormData,
  mailboxDefaultsSchema,
} from '../form/mailbox-defaults.types';
import { ForwardingCard } from './forwarding-card';
import { IdentityFields, supportAddressSchema } from './identity-fields';
import { GENERATE_LABEL, NewMailboxFrame, SAVE_PLACEHOLDER } from './new-mailbox-frame';
import { NewMailboxForm } from './new-mailbox-view';
import { useGenerateMailbox } from './use-generate-mailbox';

// What the setup step reads, selected by Generate as well so the `?id=` page starts from the store. Spread unmasked:
// the step reads it off the query and the mutations alike.
export const pendingMailboxSetupMailboxFragment = graphql`
  fragment pendingMailboxSetup_mailbox on Mailbox {
    id
    supportAddress
    provider
    inboundAddress
    receivingState
    lastTest {
      state
    }
  }
`;

const pendingMailboxSetupQuery = graphql`
  query pendingMailboxSetupQuery($id: ID!) {
    mailbox(id: $id) {
      id
      ...pendingMailboxSetup_mailbox @relay(mask: false)
    }
  }
`;

const providerMutation = graphql`
  mutation pendingMailboxSetupProviderMutation($input: UpdatePendingMailboxInput!) {
    updatePendingMailbox(input: $input) {
      mailbox {
        id
        ...pendingMailboxSetup_mailbox @relay(mask: false)
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const activateMutation = graphql`
  mutation pendingMailboxSetupActivateMutation($input: ActivateMailboxInput!) {
    activateMailbox(input: $input) {
      mailbox {
        id
        receivingState
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

/**
 * `/settings/email-to-ticket/new?id=` once Generate created the Pending mailbox: its forwarding address, the routing
 * defaults and Save Mailbox. Own boundary: in its scope the reader draws the first step's locked form.
 */
export function PendingMailboxSetup({ id }: { id: string }) {
  return (
    <LoadingSuspense live label="Loading mailbox">
      <PendingMailboxSetupReader id={id} />
    </LoadingSuspense>
  );
}

function PendingMailboxSetupReader({ id }: { id: string }) {
  if (useLoadingScope()) return <NewMailboxForm />;
  return <PendingMailboxSetupQuery id={id} />;
}

function PendingMailboxSetupQuery({ id }: { id: string }) {
  const router = useRouter();
  const retryKey = useRetryKey();
  const { mailbox } = useLazyLoadQuery<PendingMailboxSetupQueryType>(
    pendingMailboxSetupQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const saved = mailbox != null && mailbox.receivingState !== MailboxReceivingState.PENDING;
  // A saved mailbox has no setup left: its page is the details page (a Back into history, a reload after Save).
  useEffect(() => {
    if (saved) router.replace(routes.settings.emailToTicket.details(id));
  }, [saved, id, router]);

  if (!mailbox) {
    return (
      <NewMailboxFrame>
        <NotFoundError message="Mailbox not found" onHome={() => router.replace(routes.settings.emailToTicket.list)} />
      </NewMailboxFrame>
    );
  }
  // On its way to the details page: the locked form, not a blank page.
  if (saved) {
    return (
      <LoadingScope>
        <NewMailboxForm />
      </LoadingScope>
    );
  }
  return <PendingMailboxForm key={mailbox.id} mailbox={mailbox} />;
}

type PendingMailbox = NonNullable<PendingMailboxSetupQueryType['response']['mailbox']>;

function PendingMailboxForm({ mailbox }: { mailbox: PendingMailbox }) {
  const { toast } = useToast();
  const router = useRouter();
  const provider = knownValue(MailboxProvider, mailbox.provider) ?? MailboxProvider.MICROSOFT_365;
  const [address, setAddress] = useState(mailbox.supportAddress);
  const { generate, isGenerating } = useGenerateMailbox();
  const [commitProvider, isChangingProvider] = useMutation<ProviderMutationType>(providerMutation);
  const [commitActivate, isSaving] = useMutation<ActivateMutationType>(activateMutation);
  const form = useForm<MailboxDefaultsFormData>({
    resolver: zodResolver(mailboxDefaultsSchema),
    defaultValues: EMPTY_MAILBOX_DEFAULTS,
  });

  // The forwarding address was made for the address it was generated for: another address needs its own.
  const addressChanged = address.trim().toLowerCase() !== mailbox.supportAddress;
  const addressValid = supportAddressSchema.safeParse(address).success;
  const busy = isGenerating || isChangingProvider || isSaving;
  const testPassed = mailbox.lastTest.state === ForwardingTestState.PASSED;

  const changeProvider = (next: MailboxProvider) => {
    if (next === provider) return;
    commitProvider({
      variables: { input: { mailboxId: mailbox.id, provider: next } },
      onCompleted: ({ updatePendingMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          toast({
            title: 'Could not change the provider',
            description: mailboxUserErrorMessage(refusal),
            variant: 'destructive',
          });
        }
      },
      onError: error => {
        toast({
          title: 'Could not change the provider',
          description: mailboxRequestErrorMessage(error),
          variant: 'destructive',
        });
      },
    });
  };

  const save = form.handleSubmit(values => {
    commitActivate({
      variables: { input: { mailboxId: mailbox.id, ...values } },
      onCompleted: ({ activateMailbox: { userErrors } }) => {
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
          description: `Emails forwarded from ${mailbox.supportAddress} now become tickets.`,
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
    <NewMailboxFrame
      actions={[
        {
          ...SAVE_PLACEHOLDER,
          // Save takes a passed forwarding test (contract part A, `activateMailbox`).
          disabled: !testPassed || addressChanged || busy,
          loading: isSaving,
          onClick: save,
        },
      ]}
    >
      <IdentityFields
        provider={provider}
        onProviderChange={changeProvider}
        address={address}
        onAddressChange={setAddress}
        disabled={busy}
      />
      {addressChanged ? (
        <div>
          <Button
            variant="accent"
            onClick={() => generate({ provider, supportAddress: address.trim(), replacesMailboxId: mailbox.id })}
            disabled={!addressValid || busy}
            loading={isGenerating}
            className="w-full content-md:w-auto"
          >
            {GENERATE_LABEL}
          </Button>
        </div>
      ) : (
        <ForwardingCard
          supportAddress={mailbox.supportAddress}
          provider={mailbox.provider}
          inboundAddress={mailbox.inboundAddress}
        />
      )}
      <MailboxDefaultsFields control={form.control} setValue={form.setValue} disabled={busy} />
    </NewMailboxFrame>
  );
}
