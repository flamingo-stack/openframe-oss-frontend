'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

interface ArticleDetailTitleProps {
  title: string;
  /** The title is the article's name and it is still loading — drawn as a bar. */
  loading?: boolean;
  actions?: PageActionButton[];
  /** The actions depend on the article's status, which is not in yet — drawn as placeholders. */
  loadingActions?: boolean;
  menuActions?: ActionsMenuGroup[];
}

/** The article page's title and Back, for a page whose title is the record itself. */
export function ArticleDetailTitle({ title, loading, actions, loadingActions, menuActions }: ArticleDetailTitleProps) {
  const handleBack = useSafeBack(routes.knowledgeBase.list);
  return (
    <TitleBlock
      title={title}
      loading={loading}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="menu-primary"
      loadingActions={loadingActions}
      menuActions={menuActions}
    />
  );
}
