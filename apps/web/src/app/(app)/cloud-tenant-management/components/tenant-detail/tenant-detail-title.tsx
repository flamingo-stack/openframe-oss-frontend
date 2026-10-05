'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

export const TENANT_DETAIL_TITLE = 'Tenant';

interface TenantDetailTitleProps {
  title: string;
  /** The title is the record's name and it is still loading — drawn as a bar. */
  loading?: boolean;
  /** Reconnect and Edit; they hang on the route, not on the record. */
  actions?: PageActionButton[];
  /** The record is not confirmed yet — the actions are drawn as placeholders in their own widths. */
  loadingActions?: boolean;
}

/** The details page's title and Back, for a page whose title is the record itself (canon `DetailTitle`). */
export function TenantDetailTitle({ title, loading, actions, loadingActions }: TenantDetailTitleProps) {
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  return (
    <TitleBlock
      title={title}
      loading={loading}
      actions={actions}
      actionsVariant="icon-buttons"
      loadingActions={loadingActions}
      backButton={{ label: 'Back', onClick: handleBack }}
    />
  );
}
