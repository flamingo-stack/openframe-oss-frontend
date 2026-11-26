import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { graphql, useMutation } from 'react-relay';
import type { useGenerateMailboxCreateMutation as CreateMutationType } from '@/__generated__/useGenerateMailboxCreateMutation.graphql';
import type { MailboxProvider } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';

const createMutation = graphql`
  mutation useGenerateMailboxCreateMutation($input: CreateMailboxInput!) {
    createMailbox(input: $input) {
      mailbox {
        id
        receivingState
        ...pendingMailboxForm_mailbox
      }
      userErrors {
        ...mailboxErrors_userError
      }
    }
  }
`;

/** Generate: creates the Pending mailbox (or returns the one this address already has) and moves to its `?id=`. */
export function useGenerateMailbox() {
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
