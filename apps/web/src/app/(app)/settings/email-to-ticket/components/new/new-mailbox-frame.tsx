'use client';

import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

export const NEW_MAILBOX_TITLE = 'New Mailbox';
export const GENERATE_LABEL = 'Generate Forwarding Address';
export const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Mailbox', variant: 'accent', disabled: true };

/** The frame of both steps: title, Back to the list, and Save in the title bar. */
export function NewMailboxFrame({
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
      subtitle="OpenFrame never signs in to this mailbox or reads it."
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">{children}</div>
    </PageLayout>
  );
}
