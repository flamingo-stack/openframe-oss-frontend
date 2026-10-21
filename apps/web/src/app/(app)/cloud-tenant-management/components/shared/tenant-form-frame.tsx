'use client';

import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

/** The label of the button that mints a connection's consent link (the New form and the Connect form's domain edit). */
export const GENERATE_LINK_LABEL = 'Generate Connection Link';

/**
 * Save in the title bar before it can act (no record, or a step before the connect step): drawn, locked. A form's
 * live Save spreads it and sets its own handler and state, so the label is written once.
 */
export const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };

/**
 * The frame of every tenant integration form (New, Connect, Edit, Reconnect): the title, Back to the list (live, so
 * it works while the record loads) and Save in the title bar, the placeholder until the page has a live one.
 */
export function TenantFormFrame({
  title,
  actions = [SAVE_PLACEHOLDER],
  children,
}: {
  title: string;
  actions?: PageActionButton[];
  children: ReactNode;
}) {
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  return (
    <PageLayout
      title={title}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      {children}
    </PageLayout>
  );
}
