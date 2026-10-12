'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

interface KnowledgeBaseListTitleProps {
  title: string;
  /** The title is a folder's name and the folder is still loading — drawn as a bar. */
  loading?: boolean;
  /** Where Back leads when there is no history to return to. The root has no Back. */
  backTo?: string;
  /** Archive, New Folder, Add Article — they hang on the route, not on the folder. */
  actions: PageActionButton[];
  /** What can be done to the folder the page shows. */
  menuActions?: ActionsMenuGroup[];
}

/** The title row of a knowledge base listing — the root's or a folder's. */
export function KnowledgeBaseListTitle({ title, loading, backTo, actions, menuActions }: KnowledgeBaseListTitleProps) {
  const handleBack = useSafeBack(backTo ?? routes.knowledgeBase.list);
  return (
    <TitleBlock
      title={title}
      loading={loading}
      backButton={backTo ? { label: 'Back', onClick: handleBack } : undefined}
      actions={actions}
      actionsVariant="menu-primary"
      menuActions={menuActions}
    />
  );
}
