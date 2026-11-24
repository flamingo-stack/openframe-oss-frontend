'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { graphql, useMutation } from 'react-relay';
import type { disconnectMailboxDialogMutation as DisconnectMutationType } from '@/__generated__/disconnectMailboxDialogMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { routes } from '@/lib/routes';
import { mailboxRequestErrorMessage, mailboxUserErrorMessage } from '../../utils/mailbox-errors';
import { mailboxProviderPresentation } from '../../utils/mailbox-presentation';

// `deletedId` is the mailbox's own id: the record leaves the store, so the list drops its row without a refetch.
const disconnectMutation = graphql`
  mutation disconnectMailboxDialogMutation($input: MailboxIdInput!) {
    disconnectMailbox(input: $input) {
      deletedId @deleteRecord
      userErrors {
        code
        field
        message
      }
    }
  }
`;

interface DisconnectMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxId: string;
  supportAddress: string;
  provider: string;
  /** True from the confirm until the answer: a disconnect that succeeds removes the record before the page leaves. */
  onLeavingChange: (leaving: boolean) => void;
}

/**
 * Disconnect Mailbox (Figma 4630-7765). Its tickets and their conversations stay; held emails stay too (D32). The
 * forwarding is the customer's own, so the dialog says to turn it off: until then the copies are dropped on arrival.
 */
export function DisconnectMailboxDialog({
  open,
  onOpenChange,
  mailboxId,
  supportAddress,
  provider,
  onLeavingChange,
}: DisconnectMailboxDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [commit, isDisconnecting] = useMutation<DisconnectMutationType>(disconnectMutation);
  const { label: providerLabel } = mailboxProviderPresentation(provider);

  const disconnect = () => {
    onLeavingChange(true);
    commit({
      variables: { input: { mailboxId } },
      onCompleted: ({ disconnectMailbox: { userErrors } }) => {
        const [refusal] = userErrors;
        if (refusal) {
          onLeavingChange(false);
          toast({
            title: 'Could not disconnect the mailbox',
            description: mailboxUserErrorMessage(refusal),
            variant: 'destructive',
          });
          return;
        }
        onOpenChange(false);
        toast({
          title: 'Mailbox disconnected',
          description: `OpenFrame no longer creates tickets from ${supportAddress}.`,
          variant: 'success',
        });
        router.replace(routes.settings.emailToTicket.list);
      },
      onError: error => {
        onLeavingChange(false);
        toast({
          title: 'Could not disconnect the mailbox',
          description: mailboxRequestErrorMessage(error),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Disconnect Mailbox"
      description={`OpenFrame stops creating tickets from ${supportAddress}. Existing tickets and their conversations stay as they are.`}
      extraContent={
        <>
          <div className="flex items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border p-[var(--spacing-system-m)]">
            <AlertTriangleIcon size={20} className="shrink-0 text-ods-warning" aria-hidden />
            <p className="font-semibold text-ods-text-primary text-h6">
              Turn off forwarding in {providerLabel}. Until you do, copies of every email keep going to OpenFrame and
              are deleted on arrival.
            </p>
          </div>
          <p className="text-ods-text-primary text-h4">
            OpenFrame also signs out of the mailbox and can no longer send replies as it.
          </p>
        </>
      }
      confirmLabel="Disconnect"
      cancelLabel="Back"
      variant="destructive"
      isPending={isDisconnecting}
      onConfirm={disconnect}
    />
  );
}
