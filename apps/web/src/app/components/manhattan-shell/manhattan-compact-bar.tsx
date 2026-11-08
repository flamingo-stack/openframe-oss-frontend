'use client';

import {
  Menu01Icon,
  OpenframeLogoIcon,
  OpenframeTextIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/** One glyph button of the bar, as the sidebars' footer buttons. */
const BAR_BUTTON_CLASS = cn(
  'flex h-full shrink-0 items-center gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-mf)] text-ods-text-primary transition-colors',
  'hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:cursor-not-allowed disabled:opacity-50',
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
);

interface ManhattanCompactBarProps {
  /** Opens the chats sidebar over the centre. */
  onOpenChats: () => void;
  /** Opens the navigation over the centre. */
  onOpenNavigation: () => void;
  /** Behind the paywall: the chats are not reachable (the navigation is, as the rails are). */
  chatsDisabled?: boolean;
}

/**
 * The Manhattan v2 top bar where the two rails and the centre's 800px do not fit
 * (`ManhattanSqueeze.compact`, plan D19): the OpenFrame logo opens the chats, the menu
 * button on the right opens the navigation, each as a drawer over the centre. From md
 * only: below it the phone top bar and its burger serve.
 */
export function ManhattanCompactBar({
  onOpenChats,
  onOpenNavigation,
  chatsDisabled = false,
}: ManhattanCompactBarProps) {
  return (
    <div className="hidden h-14 shrink-0 items-stretch justify-between border-b border-ods-border-panel bg-ods-panel md:flex">
      <button
        type="button"
        className={BAR_BUTTON_CLASS}
        onClick={onOpenChats}
        disabled={chatsDisabled}
        aria-label="Open chats"
        title="Chats"
      >
        <OpenframeLogoIcon
          secondaryColor="var(--color-accent-primary)"
          className="h-6 w-6 shrink-0"
          color="var(--color-text-primary)"
        />
        <OpenframeTextIcon color="var(--color-text-primary)" className="h-4 w-[87px]" />
      </button>
      <button
        type="button"
        className={cn(BAR_BUTTON_CLASS, 'border-l border-ods-border-panel')}
        onClick={onOpenNavigation}
        aria-label="Open navigation"
        title="Navigation"
      >
        <Menu01Icon size={24} />
      </button>
    </div>
  );
}
