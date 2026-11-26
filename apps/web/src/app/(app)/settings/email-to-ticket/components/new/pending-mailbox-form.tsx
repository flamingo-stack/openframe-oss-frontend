'use client';
'use no memo';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { pendingMailboxForm_mailbox$key } from '@/__generated__/pendingMailboxForm_mailbox.graphql';
import type { pendingMailboxFormActivateMutation as ActivateMutationType } from '@/__generated__/pendingMailboxFormActivateMutation.graphql';
import type { pendingMailboxFormProviderMutation as ProviderMutationType } from '@/__generated__/pendingMailboxFormProviderMutation.graphql';
import { ForwardingTestState, MailboxProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { EMPTY_MAILBOX_DEFAULTS, type MailboxDefaultsFormData, mailboxDefaultsSchema } from '../form/mailbox-defaults';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import { SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';
import { ForwardingCard } from './forwarding-card';
import { IdentityFields, supportAddressSchema } from './identity-fields';
import { GENERATE_LABEL, NewMailboxFrame } from './new-mailbox-frame';
import { useGenerateMailbox } from './use-generate-mailbox';

const pendingMailboxFormFragment = graphql`
  fragment pendingMailboxForm_mailbox on Mailbox {
    id
    supportAddress
    provider
    lastTest {
      state
    }
    ...forwardingCard_mailbox
  }
`;

const providerMutation = graphql`
  mutation pendingMailboxFormProviderMutation($input: UpdatePendingMailboxInput!) {
    updatePendingMailbox(input: $input) {
      mailbox {
        id
        ...pendingMailboxForm_mailbox
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

const activateMutation = graphql`
  mutation pendingMailboxFormActivateMutation($input: ActivateMailboxInput!) {
    activateMailbox(input: $input) {
      mailbox {
        id
        receivingState
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/** The Pending mailbox's setup: provider, its forwarding address and steps, the routing defaults, Save Mailbox. */
export function PendingMailboxForm({ mailbox }: { mailbox: pendingMailboxForm_mailbox$key }) {
  const data = useFragment(pendingMailboxFormFragment, mailbox);
  const { toast } = useToast();
  const router = useRouter();
  const provider = knownValue(MailboxProvider, data.provider) ?? MailboxProvider.MICROSOFT_365;
  const [address, setAddress] = useState(data.supportAddress);
  const { generate, isGenerating } = useGenerateMailbox();
  const [commitProvider, isChangingProvider] = useMutation<ProviderMutationType>(providerMutation);
  const [commitActivate, isSaving] = useMutation<ActivateMutationType>(activateMutation);
  const form = useForm<MailboxDefaultsFormData>({
    resolver: zodResolver(mailboxDefaultsSchema),
    defaultValues: EMPTY_MAILBOX_DEFAULTS,
  });

  // The forwarding address was made for the address it was generated for: another address needs its own.
  const addressChanged = address.trim().toLowerCase() !== data.supportAddress;
  const busy = isGenerating || isChangingProvider || isSaving;

  const changeProvider = (next: MailboxProvider) => {
    if (next === provider) return;
    const fail = (description: string) => {
      toast({ title: 'Could not change the provider', description, variant: 'destructive' });
    };
    commitProvider({
      variables: { input: { mailboxId: data.id, provider: next } },
      onCompleted: ({ updatePendingMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) fail(mailboxUserErrorMessage(refusal));
      },
      onError: error => fail(mailboxRequestErrorMessage(error)),
    });
  };

  const save = form.handleSubmit(values => {
    const fail = (description: string) => {
      toast({ title: 'Could not save the mailbox', description, variant: 'destructive' });
    };
    commitActivate({
      variables: { input: { mailboxId: data.id, ...values } },
      onCompleted: ({ activateMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          fail(mailboxUserErrorMessage(refusal));
          return;
        }
        toast({
          title: 'Mailbox saved',
          description: `Emails forwarded from ${data.supportAddress} now become tickets.`,
          variant: 'success',
        });
        router.replace(routes.settings.emailToTicket.details(data.id));
      },
      onError: error => fail(mailboxRequestErrorMessage(error)),
    });
  });

  return (
    <NewMailboxFrame
      actions={[
        {
          ...SAVE_MAILBOX_ACTION,
          // Save takes a passed forwarding test (contract part A, `activateMailbox`).
          disabled: data.lastTest.state !== ForwardingTestState.PASSED || addressChanged || busy,
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
            onClick={() => generate({ provider, supportAddress: address.trim(), replacesMailboxId: data.id })}
            disabled={!supportAddressSchema.safeParse(address).success || busy}
            loading={isGenerating}
            className="w-full content-md:w-auto"
          >
            {GENERATE_LABEL}
          </Button>
        </div>
      ) : (
        <ForwardingCard mailbox={data} />
      )}
      <MailboxDefaultsFields control={form.control} setValue={form.setValue} disabled={busy} />
    </NewMailboxFrame>
  );
}
