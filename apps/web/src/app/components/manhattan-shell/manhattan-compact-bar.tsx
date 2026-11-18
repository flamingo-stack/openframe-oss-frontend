'use client';

import {
  Menu01Icon,
  OpenframeLogoIcon,
  OpenframeTextIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { HeaderMingoButton } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { COMPACT_BAND_FLEX } from './use-manhattan-squeeze';

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
  /**
   * The window is not read yet (`ManhattanSqueeze.measured`): shown by the stylesheet, in the
   * compact band only, so the first paint there has the bar before the JS knows the form.
   */
  bandOnly?: boolean;
}

/**
 * The Manhattan v2 top bar where the two rails and the centre's 800px do not fit
 * (`ManhattanSqueeze.compact`): Mingo's button at the left opens the chats, the menu
 * button at the right opens the navigation, each as a drawer over the centre — the phone
 * top bar's order (`mobileMenuSide="end"`). From md only: below it the phone top bar serves.
 */
export function ManhattanCompactBar({
  onOpenChats,
  onOpenNavigation,
  chatsDisabled = false,
  bandOnly = false,
}: ManhattanCompactBarProps) {
  return (
    <div
      className={cn(
        'hidden h-14 shrink-0 items-stretch border-b border-ods-border-panel bg-ods-panel',
        bandOnly ? COMPACT_BAND_FLEX : 'md:flex',
      )}
    >
      {/* The chats at the left, as the phone top bar has them: Mingo's button. */}
      <HeaderMingoButton
        onClick={onOpenChats}
        iconOnly
        disabled={chatsDisabled}
        className="border-r border-ods-border-panel"
      />
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-mf)]">
        <OpenframeLogoIcon
          secondaryColor="var(--color-accent-primary)"
          className="h-6 w-6 shrink-0"
          color="var(--color-text-primary)"
        />
        <OpenframeTextIcon color="var(--color-text-primary)" className="h-4 w-[87px]" />
      </div>
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
