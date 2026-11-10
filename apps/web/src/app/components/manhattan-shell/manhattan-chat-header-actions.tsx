import { Collapse02Icon, Expand01Icon, XmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { AppLayoutWorkAreaMode } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import type { ComposerRoute } from '@/app/components/mingo-shell/mingo-dock-route';

interface ManhattanHeaderActionsOptions {
  route: ComposerRoute;
  columnMode: AppLayoutWorkAreaMode;
  openDialogId: string | null;
  lastPage: string | null;
  /** One column (`ManhattanSqueeze.compact`): nothing goes side by side. */
  compact?: boolean;
  showBesidePage: () => void;
  fullScreen: () => void;
  restoreSplit: () => void;
  closeChat: () => void;
}

/**
 * The v2 chat column header's cells after the chat's ⋯ (plan matrix H, table T): on the
 * chat's own page "Show side by side" (the last page beside it) and "Close chat" (Start
 * Work); in split "Full screen" and "Close chat" (the page alone, no open chat); over a
 * page "Show side by side" and "Close chat". A chat not created yet has none of them but
 * its close.
 */
export function manhattanHeaderActions({
  route,
  columnMode,
  openDialogId,
  lastPage,
  compact = false,
  showBesidePage,
  fullScreen,
  restoreSplit,
  closeChat,
}: ManhattanHeaderActionsOptions) {
  const close = { id: 'close-chat', label: 'Close chat', icon: <XmarkIcon size={20} />, onClick: closeChat };
  const sideBySide = (onClick: () => void) => ({
    id: 'show-side-by-side',
    label: 'Show side by side',
    icon: <Collapse02Icon size={20} />,
    onClick,
  });
  if (route === 'chat') return openDialogId && lastPage && !compact ? [sideBySide(showBesidePage), close] : [close];
  if (columnMode === 'split')
    return [{ id: 'full-screen', label: 'Full screen', icon: <Expand01Icon size={20} />, onClick: fullScreen }, close];
  if (columnMode === 'chat') return route === 'full-width' || compact ? [close] : [sideBySide(restoreSplit), close];
  return undefined;
}
