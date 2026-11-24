'use client';
'use no memo';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  Button,
  Input,
  LoadingScope,
  NotFoundError,
  type PageActionButton,
  PageLayout,
  RadioGroupBlock,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import { z } from 'zod';
import type { newMailboxViewActivateMutation as ActivateMutationType } from '@/__generated__/newMailboxViewActivateMutation.graphql';
import type { newMailboxViewCreateMutation as CreateMutationType } from '@/__generated__/newMailboxViewCreateMutation.graphql';
import type { newMailboxViewProviderMutation as ProviderMutationType } from '@/__generated__/newMailboxViewProviderMutation.graphql';
import type { newMailboxViewQuery as NewMailboxViewQueryType } from '@/__generated__/newMailboxViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { ForwardingTestState, MailboxProvider, MailboxReceivingState } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { MAILBOX_PROVIDER_ORDER, mailboxProviderPresentation } from '../../utils/mailbox-presentation';
import { MailboxDefaultsFields } from '../form/mailbox-defaults-fields';
import {
  EMPTY_MAILBOX_DEFAULTS,
  type MailboxDefaultsFormData,
  mailboxDefaultsSchema,
} from '../form/mailbox-defaults.types';
import { ForwardingCard } from './forwarding-card';

export const NEW_MAILBOX_TITLE = 'New Mailbox';
const SUBTITLE = 'OpenFrame never signs in to this mailbox or reads it.';
const GENERATE_LABEL = 'Generate Forwarding Address';
const SAVE_LABEL = 'Save Mailbox';
const SAVE_PLACEHOLDER: PageActionButton = { label: SAVE_LABEL, variant: 'accent', disabled: true };

/** The address check of Generate: syntax only, as the API's (it trims and lower-cases on its side). */
const supportAddressSchema = z.string().trim().email();

const PROVIDER_OPTIONS = MAILBOX_PROVIDER_ORDER.map(provider => {
  const { label, radioDescription } = mailboxProviderPresentation(provider);
  return { value: provider, label, description: radioDescription };
});

// What the setup step reads, selected by Generate as well so the `?id=` page starts from the store. Spread unmasked:
// the step reads it off the query and the mutations alike.
export const newMailboxViewMailboxFragment = graphql`
  fragment newMailboxView_mailbox on Mailbox {
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

const newMailboxViewQuery = graphql`
  query newMailboxViewQuery($id: ID!) {
    mailbox(id: $id) {
      id
      ...newMailboxView_mailbox @relay(mask: false)
    }
  }
`;

const createMutation = graphql`
  mutation newMailboxViewCreateMutation($input: CreateMailboxInput!) {
    createMailbox(input: $input) {
      mailbox {
        id
        ...newMailboxView_mailbox @relay(mask: false)
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const providerMutation = graphql`
  mutation newMailboxViewProviderMutation($input: UpdatePendingMailboxInput!) {
    updatePendingMailbox(input: $input) {
      mailbox {
        id
        ...newMailboxView_mailbox @relay(mask: false)
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
  mutation newMailboxViewActivateMutation($input: ActivateMailboxInput!) {
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

/** The frame of both steps: title, Back to the list, and Save in the title bar. */
function NewMailboxFrame({
  actions = [SAVE_PLACEHOLDER],
  children,
}: {
  actions?: PageActionButton[];
  children: ReactNode;
}) {
  const handleBack = useSafeBack(routes.settings.emailToTicket.list);
  return (
    <PageLayout
      title={NEW_MAILBOX_TITLE}
      subtitle={SUBTITLE}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">{children}</div>
    </PageLayout>
  );
}

/** Generate: creates the Pending mailbox (or returns the one this address already has) and moves to its `?id=`. */
function useGenerate() {
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isGenerating] = useMutation<CreateMutationType>(createMutation);
  const generate = (input: { provider: MailboxProvider; supportAddress: string; replacesMailboxId?: string }) => {
    commit({
      variables: { input },
      updater: store => {
        const created = store.getRootField('createMailbox')?.getLinkedRecord('mailbox');
        // The `?id=` page asks for exactly this record: link it, so the page reads the store instead of refetching.
        if (created) store.getRoot().setLinkedRecord(created, 'mailbox', { id: created.getValue('id') });
      },
      onCompleted: ({ createMailbox: { mailbox, userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal || !mailbox) {
          toast({
            title: 'Could not generate the address',
            description: refusal ? mailboxUserErrorMessage(refusal) : 'Try again in a moment.',
            variant: 'destructive',
          });
          return;
        }
        // The record exists from here on: the address carries it, so a reload or Back resumes the setup.
        router.replace(routes.settings.emailToTicket.new({ id: mailbox.id }));
      },
      onError: error => {
        toast({
          title: 'Could not generate the address',
          description: mailboxRequestErrorMessage(error),
          variant: 'destructive',
        });
      },
    });
  };
  return { generate, isGenerating };
}

interface IdentityFieldsProps {
  provider: MailboxProvider;
  onProviderChange: (provider: MailboxProvider) => void;
  address: string;
  onAddressChange: (address: string) => void;
  disabled: boolean;
}

/** The provider radio and the Mailbox Address field (Figma 4527-132679). */
function IdentityFields({ provider, onProviderChange, address, onAddressChange, disabled }: IdentityFieldsProps) {
  return (
    <>
      <RadioGroupBlock
        name="provider"
        value={provider}
        onValueChange={value => {
          const next = knownValue(MailboxProvider, value);
          if (next) onProviderChange(next);
        }}
        options={PROVIDER_OPTIONS}
        variant="grouped"
        disabled={disabled}
        aria-label="Provider"
      />
      <Input
        label="Mailbox Address"
        labelVariant="large"
        type="email"
        placeholder="Enter Mailbox Address"
        value={address}
        onChange={event => onAddressChange(event.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
    </>
  );
}

/**
 * `/settings/email-to-ticket/new` before a mailbox exists (Figma 4527-132679): provider, address, Generate. In a
 * loading scope (the flag's window) every control is drawn, locked.
 */
export function NewMailboxForm() {
  const loading = useLoadingScope();
  const [provider, setProvider] = useState<MailboxProvider>(MailboxProvider.MICROSOFT_365);
  const [address, setAddress] = useState('');
  const { generate, isGenerating } = useGenerate();
  const valid = supportAddressSchema.safeParse(address).success;
  return (
    <NewMailboxFrame>
      <IdentityFields
        provider={provider}
        onProviderChange={setProvider}
        address={address}
        onAddressChange={setAddress}
        disabled={loading || isGenerating}
      />
      <div>
        <Button
          variant="accent"
          onClick={() => generate({ provider, supportAddress: address.trim() })}
          disabled={loading || !valid}
          loading={isGenerating}
          className="w-full content-md:w-auto"
        >
          {GENERATE_LABEL}
        </Button>
      </div>
    </NewMailboxFrame>
  );
}

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
  const { mailbox } = useLazyLoadQuery<NewMailboxViewQueryType>(
    newMailboxViewQuery,
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

type PendingMailbox = NonNullable<NewMailboxViewQueryType['response']['mailbox']>;

function PendingMailboxForm({ mailbox }: { mailbox: PendingMailbox }) {
  const { toast } = useToast();
  const router = useRouter();
  const provider = knownValue(MailboxProvider, mailbox.provider) ?? MailboxProvider.MICROSOFT_365;
  const [address, setAddress] = useState(mailbox.supportAddress);
  const { generate, isGenerating } = useGenerate();
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
