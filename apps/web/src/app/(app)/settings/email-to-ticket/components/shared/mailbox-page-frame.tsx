'use client';

import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

/** Save in the title bar, locked until its form can submit. */
export const SAVE_MAILBOX_ACTION: PageActionButton = { label: 'Save Mailbox', variant: 'accent', disabled: true };

interface MailboxPageFrameProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  actions?: PageActionButton[];
  children: ReactNode;
}

/** The frame of a mailbox page (new, details, edit): Back to the list, the actions in the title bar. */
export function MailboxPageFrame({ title, subtitle, loading, actions, children }: MailboxPageFrameProps) {
  const handleBack = useSafeBack(routes.settings.emailToTicket.list);
  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      loading={loading}
      loadingActions={loading}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">{children}</div>
    </PageLayout>
  );
}
