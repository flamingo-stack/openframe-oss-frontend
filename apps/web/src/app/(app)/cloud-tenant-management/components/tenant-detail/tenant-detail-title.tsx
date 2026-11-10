'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

export const TENANT_DETAIL_TITLE = 'Tenant';

/**
 * The lines a typical tenant name takes while it loads: a customer's tenant name ("Test Andrii Microsoft") runs past
 * the ~20 characters a phone's title line holds, so two there; one truncated line from `content-md` up.
 */
const TENANT_TITLE_SKELETON_LINES = { phone: 2, md: 1, lg: 1 } as const;

interface TenantDetailTitleProps {
  title: string;
  /** The title is the record's name and it is still loading — drawn as a bar. */
  loading?: boolean;
  /** Edit, and Reconnect while the tenant cannot be read. */
  actions?: PageActionButton[];
  /** The "…" menu beside them: a phone merges them all into it. */
  menuActions?: ActionsMenuGroup[];
  /** The record is not confirmed yet — the actions are drawn as placeholders in their own widths. */
  loadingActions?: boolean;
}

/** The details page's title and Back, for a page whose title is the record itself (canon `DetailTitle`). */
export function TenantDetailTitle({ title, loading, actions, menuActions, loadingActions }: TenantDetailTitleProps) {
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  return (
    <TitleBlock
      title={title}
      loading={loading}
      titleSkeletonLines={TENANT_TITLE_SKELETON_LINES}
      actions={actions}
      menuActions={menuActions}
      actionsVariant="menu-primary"
      loadingActions={loadingActions}
      backButton={{ label: 'Back', onClick: handleBack }}
    />
  );
}
