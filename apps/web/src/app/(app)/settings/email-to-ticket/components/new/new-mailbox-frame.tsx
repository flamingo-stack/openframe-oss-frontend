'use client';

import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { MailboxPageFrame, SAVE_MAILBOX_ACTION } from '../shared/mailbox-page-frame';

export const NEW_MAILBOX_TITLE = 'New Mailbox';
export const GENERATE_LABEL = 'Generate Forwarding Address';

/** The frame of both setup steps: Save stays in the title bar, locked until the setup can be saved. */
export function NewMailboxFrame({
  actions = [SAVE_MAILBOX_ACTION],
  children,
}: {
  actions?: PageActionButton[];
  children: ReactNode;
}) {
  return (
    <MailboxPageFrame
      title={NEW_MAILBOX_TITLE}
      subtitle="OpenFrame never signs in to this mailbox or reads it."
      actions={actions}
    >
      {children}
    </MailboxPageFrame>
  );
}
