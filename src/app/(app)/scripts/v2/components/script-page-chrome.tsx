'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import type { ActionsMenuGroup, PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ComponentProps, type ReactNode, useMemo } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';

interface ScriptPageChromeProps {
  title: string;
  /** Optional subtitle line under the title (e.g. an execution UUID). */
  subtitle?: string;
  /**
   * When the subtitle line occupies the layout — see `PageLayout`. Relevant
   * whenever `subtitle` comes from the record: it is `undefined` while loading
   * and may stay empty afterwards (a schedule without a description).
   */
  subtitleRow?: ComponentProps<typeof PageLayout>['subtitleRow'];
  /** Where Back navigates when the history stack is unsafe (see `useSafeBack`). */
  backFallback: string;
  actions: PageActionButton[];
  /** Overflow ("...") menu groups — see `PageLayout.menuActions`. */
  menuActions?: ActionsMenuGroup[];
  actionsVariant?: ComponentProps<typeof PageLayout>['actionsVariant'];
  /**
   * Prepends a mobile-only "Cancel" that runs the same Back navigation.
   * For `primary-buttons` form pages whose only other action is the save: the
   * mobile bar would otherwise be one full-width Save, and the way out lives
   * off-screen at the top of the page. Pointless on pages that already carry a
   * second action — the bar renders every action, and three buttons don't fit
   * a phone row.
   */
  showMobileCancel?: boolean;
  /** Swaps the title/subtitle text for inline skeletons, keeping the header's height. */
  loading?: boolean;
  /**
   * Swaps the header ACTIONS for placeholders. Separate from `loading` on
   * purpose — only pages whose action SET depends on the record (an archived
   * entity offers "Unarchive" where an active one offers "Edit") need it;
   * everyone else keeps showing real buttons while the title loads.
   */
  loadingActions?: boolean;
  /** Rendered inline after the title — e.g. an "Archived" status `Tag`. */
  titleAdornment?: ReactNode;
  /** `PageLayout` className — defaults to the standard page padding. */
  className?: string;
  children: ReactNode;
}

/**
 * Shared page chrome (title, subtitle, Back, header actions) for the script v2
 * pages (details, edit, run, execution details). Each page renders it for both
 * the loaded view and its Suspense fallback, so the chrome never remounts and
 * the loading state never duplicates it. The Back button is fully functional
 * while the page data is still loading.
 */
export function ScriptPageChrome({
  title,
  subtitle,
  subtitleRow,
  backFallback,
  actions,
  menuActions,
  actionsVariant,
  showMobileCancel = false,
  loading,
  loadingActions,
  titleAdornment,
  className = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
  children,
}: ScriptPageChromeProps) {
  const handleBack = useSafeBack(backFallback);
  const backButton = useMemo(() => ({ label: 'Back', onClick: handleBack }), [handleBack]);

  // Injected here rather than at each call site: Cancel IS the Back button, and
  // this component already owns that navigation.
  const allActions = useMemo<PageActionButton[]>(
    () =>
      showMobileCancel
        ? [{ label: 'Cancel', onClick: handleBack, variant: 'outline' as const, showOnlyMobile: true }, ...actions]
        : actions,
    [showMobileCancel, handleBack, actions],
  );

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      subtitleRow={subtitleRow}
      backButton={backButton}
      actions={allActions}
      menuActions={menuActions}
      actionsVariant={actionsVariant}
      loading={loading}
      loadingActions={loadingActions}
      titleAdornment={titleAdornment}
      className={className}
    >
      {children}
    </PageLayout>
  );
}
